import Foundation

/// The dashboard snapshot from `GET /api/runway/current` (the persisted runway
/// projected by the backend's `snapshotRowToView`). Distinct from the widget
/// shape: it carries `availableCash` / `dailySafeSpend` but no `privacyMode`.
struct RunwaySnapshotView: Decodable, Equatable {
    let status: String
    let availableCash: Double?
    let spentToday: Double
    let billsBeforePayday: Double
    let safeToSpend: Double?
    let dailySafeSpend: Double?
    let riskLevel: String?
    let paydayDate: String?
    let daysUntilPayday: Int?
    let generatedAt: String?
    let lastUpdatedAt: String?
    let isStale: Bool

    var risk: RiskLevel { RiskLevel(rawValue: riskLevel ?? "") ?? .unknown }
    var needsData: Bool { status == "needs_data" || safeToSpend == nil }
}

/// `{ "snapshot": {...}|null, "status": "needs_data"? }`
struct RunwayCurrentResponse: Decodable {
    let snapshot: RunwaySnapshotView?
    let status: String?
}
