import Foundation
import RevenueCat

/// Tracks the user's subscription entitlement via RevenueCat. Drives the paywall
/// gate: `isSubscribed` is true while the `premium` entitlement is active (which
/// includes the 7-day free trial). No-ops gracefully if RevenueCat isn't
/// configured (empty key) — everything is treated as unlocked so builds without
/// a key still work.
@MainActor
final class SubscriptionManager: ObservableObject {
    static let shared = SubscriptionManager()
    static let entitlementID = "premium"

    /// Master switch for the paywall gate. Keep FALSE until the App Store Connect
    /// products + RevenueCat offering are configured and tested — then flip to
    /// true and ship. When false, the app is fully usable regardless of
    /// subscription (so the SDK can integrate without locking anyone out).
    static let gatingEnabled = false

    /// Whether the user currently has premium access (active sub or trial).
    @Published private(set) var isSubscribed = false
    /// True once we've resolved the initial entitlement state (avoid flashing the
    /// paywall before we know).
    @Published private(set) var isLoaded = false

    private var configured: Bool { !Secrets.revenueCatKey.isEmpty }

    /// Call once at launch. Configures RevenueCat and starts listening for
    /// entitlement changes.
    func configure() {
        guard configured else {
            // No key → don't gate. Treat as unlocked so the app is usable.
            isSubscribed = true
            isLoaded = true
            return
        }
        Purchases.logLevel = .warn
        Purchases.configure(withAPIKey: Secrets.revenueCatKey)

        Task {
            await refresh()
            for await info in Purchases.shared.customerInfoStream {
                update(info)
            }
        }
    }

    func refresh() async {
        guard configured else { return }
        if let info = try? await Purchases.shared.customerInfo() { update(info) }
        isLoaded = true
    }

    /// Link RevenueCat to the signed-in user so entitlements follow the account.
    func logIn(userId: String) {
        guard configured else { return }
        Task {
            if let (info, _) = try? await Purchases.shared.logIn(userId) { update(info) }
        }
    }

    func logOut() {
        guard configured else { return }
        Task {
            if let info = try? await Purchases.shared.logOut() { update(info) }
        }
    }

    /// Restore prior purchases (App Store requirement on the paywall).
    func restore() async {
        guard configured else { return }
        if let info = try? await Purchases.shared.restorePurchases() { update(info) }
    }

    private func update(_ info: CustomerInfo) {
        isSubscribed = info.entitlements[Self.entitlementID]?.isActive == true
        isLoaded = true
    }
}
