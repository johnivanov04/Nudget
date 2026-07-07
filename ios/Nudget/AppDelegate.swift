import UIKit
import UserNotifications
import Sentry

/// Minimal app delegate: receives the APNs device token (SwiftUI has no native
/// hook for it), presents notifications while foregrounded, and starts crash
/// reporting.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        startCrashReporting()
        return true
    }

    /// Crash + error reporting via Sentry. No-ops until a DSN is set in Secrets.
    private func startCrashReporting() {
        guard !Secrets.sentryDSN.isEmpty else { return }
        SentrySDK.start { options in
            options.dsn = Secrets.sentryDSN
            options.enableAutoSessionTracking = true
            options.tracesSampleRate = 0.0 // crashes/errors only, no perf for now
            #if DEBUG
            options.environment = "debug"
            #else
            options.environment = "production"
            #endif
        }
    }

    /// Show banners + play sound even when the app is open (otherwise iOS hides
    /// foreground notifications, which looks like "push isn't working").
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound])
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { @MainActor in PushManager.shared.didRegister(deviceTokenHex: hex) }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in PushManager.shared.didFailToRegister(error) }
    }
}
