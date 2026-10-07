import RevenueCat
import SwiftUI

@main
struct MyApp: App {
    init() {
        OpenASO.start()
        Purchases.configure(withAPIKey: "appl_your_revenuecat_key")
        Purchases.shared.attribution.setAttributes(["openAsoId": OpenASO.userId])
    }

    var body: some Scene {
        WindowGroup { ContentView() }
    }
}
