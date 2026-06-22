import SwiftUI

/// A small, non-shaming risk indicator. Color conveys state without relying on
/// color alone (it always pairs with a label + icon — accessibility).
struct RiskBadge: View {
    let risk: RiskLevel

    var body: some View {
        Label(title, systemImage: icon)
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }

    private var title: String {
        switch risk {
        case .safe: return "On track"
        case .caution: return "Keep it light"
        case .danger: return "Tight runway"
        case .unknown: return "No data yet"
        }
    }

    private var icon: String {
        switch risk {
        case .safe: return "checkmark.circle.fill"
        case .caution: return "exclamationmark.circle.fill"
        case .danger: return "exclamationmark.triangle.fill"
        case .unknown: return "questionmark.circle.fill"
        }
    }

    var color: Color {
        switch risk {
        case .safe: return .green
        case .caution: return .orange
        case .danger: return .red
        case .unknown: return .secondary
        }
    }
}
