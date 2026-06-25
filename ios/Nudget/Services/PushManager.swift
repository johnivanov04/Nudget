import Foundation
import UIKit
import UserNotifications

/// Coordinates APNs registration with the backend.
///
/// The device token (from the system) and the signed-in session can arrive in
/// either order, so we stash whichever comes first and upload once we have both.
/// The raw token is handed to the backend — which stores it encrypted — and is
/// never persisted on the client.
@MainActor
final class PushManager {
    static let shared = PushManager()
    private init() {}

    private var deviceTokenHex: String?
    private var authToken: String?
    private let api = NudgetAPI()

    /// A user signed in: remember their JWT, ask for notification permission,
    /// and upload the device token if we already have one.
    func onSignedIn(token: String) {
        authToken = token
        requestAuthorizationAndRegister()
        uploadIfReady()
    }

    /// A user signed out. We can't unregister server-side without auth, so just
    /// stop uploading; the backend prunes dead tokens when APNs rejects them.
    func onSignedOut() {
        authToken = nil
    }

    /// Forwarded from the AppDelegate once iOS hands us the APNs token.
    func didRegister(deviceTokenHex hex: String) {
        deviceTokenHex = hex
        uploadIfReady()
    }

    /// Non-fatal: the app works fine without push, so there's nothing to surface.
    func didFailToRegister(_ error: Error) {}

    private func requestAuthorizationAndRegister() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            guard granted else { return }
            Task { @MainActor in
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
    }

    private func uploadIfReady() {
        guard let hex = deviceTokenHex, let token = authToken else { return }
        Task { try? await api.registerDevice(token: token, deviceToken: hex) }
    }
}
