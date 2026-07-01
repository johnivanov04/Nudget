import SwiftUI

/// App-wide design tokens for the "clean & airy" look: a brand blue (from the
/// app icon), a soft grouped canvas, elevated white cards, and refined,
/// non-alarming risk colors. Centralized so every screen stays consistent.
enum Theme {
    /// Brand accent — the icon's blue. Used as the global tint.
    static let brand = Color(red: 0.16, green: 0.50, blue: 1.0)

    /// Page background sitting behind the cards.
    static let canvas = Color(uiColor: .systemGroupedBackground)

    /// Diagonal blue→indigo gradient for the wordmark and accents.
    static let wordmarkGradient = LinearGradient(
        colors: [Color(red: 0.16, green: 0.50, blue: 1.0),
                 Color(red: 0.40, green: 0.34, blue: 0.95)],
        startPoint: .leading,
        endPoint: .trailing
    )

    /// Calm, premium risk colors (not the harsh system green/orange/red).
    static func risk(_ r: RiskLevel) -> Color {
        switch r {
        case .safe:    return Color(red: 0.18, green: 0.70, blue: 0.43)
        case .caution: return Color(red: 0.95, green: 0.62, blue: 0.20)
        case .danger:  return Color(red: 0.89, green: 0.32, blue: 0.27)
        case .unknown: return Color.secondary
        }
    }
}

/// Soft, elevated card — the core surface of the airy aesthetic. Adapts to
/// light/dark automatically via the grouped system colors.
struct CardStyle: ViewModifier {
    var padding: CGFloat = 20
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                Color(uiColor: .secondarySystemGroupedBackground),
                in: RoundedRectangle(cornerRadius: 22, style: .continuous)
            )
            .shadow(color: .black.opacity(0.06), radius: 14, x: 0, y: 6)
    }
}

extension View {
    func card(padding: CGFloat = 20) -> some View { modifier(CardStyle(padding: padding)) }
}

/// A soft color wash fading from the top into the canvas — gives the "canvas"
/// screens depth without clutter. On the dashboard the tint follows the risk
/// level (a subtle mood cue); elsewhere it's brand blue.
struct AmbientBackground: View {
    var tint: Color = Theme.brand

    var body: some View {
        ZStack(alignment: .top) {
            Theme.canvas
            LinearGradient(
                colors: [tint.opacity(0.22), tint.opacity(0.0)],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 380)
            .blur(radius: 40)
            .frame(maxWidth: .infinity, alignment: .top)
        }
        .ignoresSafeArea()
        .animation(.easeInOut(duration: 0.45), value: tint)
    }
}

/// The Nudget wordmark — rounded, heavy, gradient-filled.
struct Wordmark: View {
    var size: Font.TextStyle = .title3
    var body: some View {
        Text("Nudget")
            .font(.system(size, design: .rounded).weight(.heavy))
            .foregroundStyle(Theme.wordmarkGradient)
    }
}

/// A brand-tinted rounded-square icon mark (sign-in, onboarding step headers).
/// Keeps the glyph treatment identical everywhere it appears.
struct BrandMark: View {
    let systemName: String
    var size: CGFloat = 80

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: size * 0.46, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(
                Theme.brand,
                in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
            )
            .shadow(color: Theme.brand.opacity(0.35), radius: size * 0.2, x: 0, y: size * 0.1)
    }
}
