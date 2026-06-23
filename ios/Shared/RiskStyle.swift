import SwiftUI

/// Maps a runway risk level (string, as shared with the widget) to a color,
/// label, and SF Symbol. Shared by the app and the widget extension.
enum RiskStyle {
    static func color(_ risk: String?) -> Color {
        switch risk {
        case "safe": return .green
        case "caution": return .orange
        case "danger": return .red
        default: return .secondary
        }
    }

    static func label(_ risk: String?) -> String {
        switch risk {
        case "safe": return "On track"
        case "caution": return "Keep it light"
        case "danger": return "Tight runway"
        default: return "No data"
        }
    }

    static func icon(_ risk: String?) -> String {
        switch risk {
        case "safe": return "checkmark.circle.fill"
        case "caution": return "exclamationmark.circle.fill"
        case "danger": return "exclamationmark.triangle.fill"
        default: return "questionmark.circle.fill"
        }
    }
}
