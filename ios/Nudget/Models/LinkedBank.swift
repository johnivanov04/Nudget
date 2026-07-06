import Foundation

/// A linked bank (Plaid item) from `GET /api/plaid/items`. Carries no accounts,
/// balances, or tokens — just enough to list and disconnect it.
struct LinkedBank: Decodable, Identifiable, Equatable {
    let id: String
    let institutionName: String?
    let status: String

    var displayName: String { institutionName ?? "Linked bank" }
}

struct LinkedBanksResponse: Decodable {
    let items: [LinkedBank]
}
