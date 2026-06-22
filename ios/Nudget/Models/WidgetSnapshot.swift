import Foundation

/// The minimal, privacy-aware runway view the backend serves to the widget and
/// the dashboard. Mirrors the JSON from `GET /api/widget/snapshot`.
struct WidgetSnapshot: Decodable, Equatable {
    let status: String
    let privacyMode: Bool
    let riskLevel: String?
    let riskReasonKey: String?
    let safeToSpend: Double?
    let spentToday: Double?
    let billsBeforePayday: Double?
    let paydayDate: String?
    let daysUntilPayday: Int?
    let lastUpdatedAt: String?
    let isStale: Bool

    /// Risk as a typed value with a sensible fallback.
    var risk: RiskLevel { RiskLevel(rawValue: riskLevel ?? "") ?? .unknown }

    var needsData: Bool { status == "needs_data" }
}

/// Wrapper for the `{ "widget": { ... } }` response envelope.
struct WidgetSnapshotResponse: Decodable {
    let widget: WidgetSnapshot
}

enum RiskLevel: String {
    case safe
    case caution
    case danger
    case unknown
}
