import AdServices
import ExpoModulesCore

public class OpenAsoAttributionModule: Module {
    public func definition() -> ModuleDefinition {
        Name("OpenAsoAttribution")

        AsyncFunction("attributionToken") { () -> String? in
            if #available(iOS 14.3, *) {
                return try? AAAttribution.attributionToken()
            }
            return nil
        }
    }
}
