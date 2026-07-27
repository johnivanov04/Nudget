import SwiftUI

@main
struct NudgetApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var session = SessionStore()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
        }
        .onChange(of: scenePhase) { _, phase in
            // Returning to the foreground (e.g. the next day) — proactively
            // refresh a stale token so the session doesn't drop on the first call.
            if phase == .active, session.isSignedIn {
                Task { await AuthTokenProvider.shared.ensureFresh() }
            }
        }
    }
}
