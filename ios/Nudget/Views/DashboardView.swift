import SwiftUI

struct DashboardView: View {
    @StateObject private var model = DashboardViewModel()

    var body: some View {
        NavigationStack {
            Group {
                switch model.state {
                case .loading:
                    ProgressView("Loading your runway…")
                case .failed(let message):
                    errorState(message)
                case .loaded(let snapshot):
                    loadedState(snapshot)
                }
            }
            .navigationTitle("Nudget")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Toggle(isOn: $model.privacyMode) {
                        Image(systemName: model.privacyMode ? "eye.slash" : "eye")
                    }
                    .toggleStyle(.button)
                    .accessibilityLabel("Privacy mode")
                }
            }
        }
        .task { await model.load() }
    }

    // MARK: - States

    private func loadedState(_ s: WidgetSnapshot) -> some View {
        ScrollView {
            VStack(spacing: 24) {
                RiskBadge(risk: s.risk)

                // Hero: safe to spend
                VStack(spacing: 4) {
                    Text("Safe to spend")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(s.privacyMode ? "•••••" : Format.currency(s.safeToSpend))
                        .font(.system(size: 52, weight: .bold, design: .rounded))
                        .contentTransition(.numericText())
                    if let days = s.daysUntilPayday {
                        Text("until payday · \(Format.shortDate(s.paydayDate)) (in \(days) day\(days == 1 ? "" : "s"))")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                // Secondary numbers
                HStack(spacing: 12) {
                    StatTile(label: "Spent today",
                             value: s.privacyMode ? "•••" : Format.currency(s.spentToday))
                    StatTile(label: "Bills before payday",
                             value: s.privacyMode ? "•••" : Format.currency(s.billsBeforePayday))
                }

                // Freshness — every number carries last-updated context.
                HStack(spacing: 6) {
                    if s.isStale {
                        Image(systemName: "clock.badge.exclamationmark")
                        Text("Data may be out of date")
                    } else {
                        Text(Format.relativeUpdated(s.lastUpdatedAt))
                    }
                }
                .font(.caption)
                .foregroundStyle(s.isStale ? Color.orange : Color.secondary)
            }
            .padding(24)
            .frame(maxWidth: .infinity)
        }
        .refreshable { await model.load() }
    }

    private func errorState(_ message: String) -> some View {
        ContentUnavailableView {
            Label("Couldn't load your runway", systemImage: "wifi.exclamationmark")
        } description: {
            Text(message)
        } actions: {
            Button("Try again") { Task { await model.load() } }
                .buttonStyle(.borderedProminent)
        }
    }
}

/// A labeled stat card used for the secondary numbers.
private struct StatTile: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}

#Preview {
    DashboardView()
}
