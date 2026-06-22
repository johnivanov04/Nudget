import SwiftUI

/// Switches between sign-in and the dashboard based on the auth state.
struct RootView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        Group {
            switch session.state {
            case .loading:
                ProgressView()
            case .signedOut:
                SignInView()
            case .signedIn(let token, _):
                DashboardView(token: token)
            }
        }
        .task {
            if case .loading = session.state { session.restore() }
        }
    }
}
