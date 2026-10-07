import AdServices
import Foundation

enum OpenASO {
    static let baseURL = URL(string: "__OPEN_ASO_URL__")!
    static let sdkToken = "__OPEN_ASO_TOKEN__"
    static let bundleId = Bundle.main.bundleIdentifier ?? "__BUNDLE_ID__"

    private static let userKey = "open_aso.user_id"
    private static let installKey = "open_aso.install_sent"

    static var userId: String {
        if let existing = UserDefaults.standard.string(forKey: userKey) { return existing }
        let created = UUID().uuidString.lowercased()
        UserDefaults.standard.set(created, forKey: userKey)
        return created
    }

    static func start() {
        let id = userId
        Task.detached(priority: .utility) {
            if !UserDefaults.standard.bool(forKey: installKey) {
                var body = ["bundleId": bundleId, "userId": id]
                if #available(iOS 14.3, macOS 11.1, *), let token = try? AAAttribution.attributionToken() {
                    body["adServicesToken"] = token
                }
                if let region = regionCode() { body["country"] = region }
                if await post("api/attribution/install", body) {
                    UserDefaults.standard.set(true, forKey: installKey)
                }
            }
            await post("api/attribution/event", ["bundleId": bundleId, "userId": id, "name": "session"])
        }
    }

    private static func regionCode() -> String? {
        if #available(iOS 16, macOS 13, *) { return Locale.current.region?.identifier }
        return Locale.current.regionCode
    }

    @discardableResult
    private static func post(_ path: String, _ body: [String: String]) async -> Bool {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(sdkToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONEncoder().encode(body)
        guard let (_, response) = try? await URLSession.shared.data(for: request) else { return false }
        return (200..<300).contains((response as? HTTPURLResponse)?.statusCode ?? 0)
    }
}
