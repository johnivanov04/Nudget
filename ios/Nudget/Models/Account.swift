import Foundation

/// A linked account from `GET /api/accounts`.
struct Account: Decodable, Identifiable, Equatable {
    let id: String
    let name: String?
    let mask: String?
    let type: String?
    let subtype: String?
    let balance: Double?
    var includedInRunway: Bool

    var displayName: String { name ?? subtype?.capitalized ?? "Account" }
}

struct AccountsResponse: Decodable {
    let accounts: [Account]
}
