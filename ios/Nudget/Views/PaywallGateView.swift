import SwiftUI
import RevenueCatUI

/// The subscription paywall shown when a signed-in user isn't premium. Uses the
/// paywall configured in the RevenueCat dashboard (products + offering). A
/// sign-out escape keeps the user from being trapped if they don't subscribe.
struct PaywallGateView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        PaywallView(displayCloseButton: false)
            .overlay(alignment: .topTrailing) {
                Button("Sign out") { session.signOut() }
                    .font(.footnote)
                    .padding(12)
                    .foregroundStyle(.secondary)
            }
    }
}
