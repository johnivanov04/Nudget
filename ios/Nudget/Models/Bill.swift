import Foundation

/// A detected or confirmed recurring bill from `GET /api/bills/detected`.
struct Bill: Decodable, Identifiable, Equatable {
    let id: String
    let merchantName: String?
    let amountEstimate: Double
    let cadence: String?
    let nextExpectedDate: String?
    let confidence: Double?
    let status: String
    /// Candidate (auto-detected, unconfirmed) bills are shown as "likely".
    let likely: Bool

    var displayName: String { merchantName ?? "Recurring charge" }
    var isConfirmed: Bool { status == "confirmed" }
}

struct BillsResponse: Decodable {
    let bills: [Bill]
}
