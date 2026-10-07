import AdServices
import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
    override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let controller = window?.rootViewController as! FlutterViewController
        let channel = FlutterMethodChannel(name: "open_aso/attribution", binaryMessenger: controller.binaryMessenger)
        channel.setMethodCallHandler { call, result in
            guard call.method == "attributionToken" else { return result(FlutterMethodNotImplemented) }
            if #available(iOS 14.3, *) {
                result(try? AAAttribution.attributionToken())
            } else {
                result(nil)
            }
        }
        GeneratedPluginRegistrant.register(with: self)
        return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }
}
