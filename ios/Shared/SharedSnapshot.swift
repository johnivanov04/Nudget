import Foundation

/// The minimal runway data the widget renders. The app writes this to the shared
/// App Group container after each dashboard load; the widget reads it. Codable so
/// it can round-trip through the shared `UserDefaults`.
struct SharedSnapshot: Codable, Equatable {
    var status: String
    var safeToSpend: Double?
    var spentToday: Double?
    var billsBeforePayday: Double?
    var riskLevel: String?
    var paydayDate: String?
    var daysUntilPayday: Int?
    var lastUpdatedAt: String?
    var isStale: Bool
}
