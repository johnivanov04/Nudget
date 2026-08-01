import SwiftUI

/// Switches between sign-in and the dashboard based on the auth state.
struct RootView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var subscription = SubscriptionManager.shared

    var body: some View {
        Group {
            switch session.state {
            case .loading:
                ProgressView()
            case .signedOut:
                SignInView()
            case .signedIn(let token, _):
                signedIn(token: token)
            }
        }
        .tint(Theme.brand)
        .task {
            if case .loading = session.state { session.restore() }
        }
    }

    @ViewBuilder
    private func signedIn(token: String) -> some View {
        // Gate behind the subscription once enabled + resolved; otherwise the app
        // is fully usable. (During the trial the entitlement is active.)
        if SubscriptionManager.gatingEnabled && subscription.isLoaded && !subscription.isSubscribed {
            PaywallGateView()
        } else {
            DashboardView(token: token)
        }
    }
}
