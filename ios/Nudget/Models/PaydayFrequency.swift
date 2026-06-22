import Foundation

/// The pay cadences offered during onboarding. Mirrors the backend's
/// `paycheckScheduleSchema` frequencies (custom is omitted from the UI for now).
enum PaydayFrequency: String, CaseIterable, Identifiable {
    case weekly
    case biweekly
    case semimonthly
    case monthly

    var id: String { rawValue }

    var label: String {
        switch self {
        case .weekly: return "Weekly"
        case .biweekly: return "Every 2 weeks"
        case .semimonthly: return "Twice a month"
        case .monthly: return "Monthly"
        }
    }
}
