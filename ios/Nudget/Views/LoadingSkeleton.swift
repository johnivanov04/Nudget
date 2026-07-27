import SwiftUI

/// An animated shimmer used by skeleton placeholders — a soft light band that
/// sweeps left-to-right, signalling "content is loading" without a spinner.
private struct Shimmer: ViewModifier {
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geo in
                    let width = geo.size.width
                    LinearGradient(
                        colors: [.clear, .white.opacity(0.55), .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: width * 0.6)
                    .offset(x: phase * width * 1.6)
                    .blendMode(.plusLighter)
                }
            )
            .mask(content)
            .onAppear {
                withAnimation(.linear(duration: 1.25).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

private extension View {
    func shimmering() -> some View { modifier(Shimmer()) }
}

/// A single rounded placeholder block.
private struct SkeletonBlock: View {
    var width: CGFloat? = nil
    var height: CGFloat
    var cornerRadius: CGFloat = 8

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(Color(uiColor: .tertiarySystemFill))
            .frame(width: width, height: height)
    }
}

/// A loading placeholder that mirrors the real dashboard layout so the content
/// appears to materialize in place rather than popping in after a blank spinner.
struct DashboardSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Hero card
                VStack(spacing: 14) {
                    SkeletonBlock(width: 96, height: 22, cornerRadius: 11)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    VStack(spacing: 10) {
                        SkeletonBlock(width: 130, height: 12)
                        SkeletonBlock(width: 220, height: 46, cornerRadius: 12)
                        SkeletonBlock(width: 180, height: 12)
                    }
                }
                .frame(maxWidth: .infinity)
                .card(padding: 28)

                // Pace card
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 14) {
                        SkeletonBlock(width: 40, height: 40, cornerRadius: 11)
                        VStack(alignment: .leading, spacing: 6) {
                            SkeletonBlock(width: 90, height: 10)
                            SkeletonBlock(width: 140, height: 16)
                        }
                        Spacer()
                    }
                    SkeletonBlock(height: 10, cornerRadius: 5)
                }
                .card(padding: 16)

                // Two stat tiles
                HStack(spacing: 12) {
                    ForEach(0..<2, id: \.self) { _ in
                        VStack(alignment: .leading, spacing: 10) {
                            SkeletonBlock(width: 34, height: 34, cornerRadius: 10)
                            SkeletonBlock(width: 70, height: 10)
                            SkeletonBlock(width: 90, height: 18)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .card(padding: 16)
                    }
                }
            }
            .padding(20)
            .frame(maxWidth: .infinity)
        }
        .shimmering()
        .accessibilityLabel("Loading your runway")
    }
}
