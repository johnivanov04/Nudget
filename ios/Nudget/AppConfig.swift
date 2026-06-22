import Foundation

/// App-wide configuration. For now just the backend base URL.
///
/// The iOS Simulator can reach the dev server on the Mac via `localhost`. On a
/// physical device, change this to your Mac's LAN IP (e.g. http://192.168.1.x:3000)
/// and make sure the device is on the same network.
enum AppConfig {
    static let baseURL = URL(string: "http://localhost:3000")!
}
