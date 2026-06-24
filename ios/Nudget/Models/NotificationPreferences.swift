import Foundation

/// `GET|POST /api/nudges/preferences`.
struct NotificationPreferences: Codable, Equatable {
    var enabled: Bool
    var morningEnabled: Bool
    var billApproachEnabled: Bool
    var dangerEnabled: Bool
    var tone: String
    var morningHour: Int
    var morningMinute: Int
    var allowExtra: Bool

    static let fallback = NotificationPreferences(
        enabled: true,
        morningEnabled: true,
        billApproachEnabled: true,
        dangerEnabled: true,
        tone: "gentle",
        morningHour: 8,
        morningMinute: 0,
        allowExtra: false
    )
}

struct NotificationPreferencesResponse: Decodable {
    let preferences: NotificationPreferences
}
