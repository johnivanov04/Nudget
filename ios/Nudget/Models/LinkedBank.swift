import Foundation

/// A linked bank (Plaid item) from `GET /api/plaid/items`. Carries no accounts,
/// balances, or tokens — just enough to list and disconnect it.
struct LinkedBank: Decodable, Identifiable, Equatable {
    let id: String
    let institutionName: String?
    let status: String

    var displayName: String { institutionName ?? "Linked bank" }

    /// The connection needs the user to re-authenticate (Plaid `login_required`).
    var needsReconnect: Bool { status == "login_required" }
}

struct LinkedBanksResponse: Decodable {
    let items: [LinkedBank]
}
