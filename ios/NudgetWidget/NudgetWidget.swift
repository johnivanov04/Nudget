import WidgetKit
import SwiftUI

struct SnapshotEntry: TimelineEntry {
    let date: Date
    let snapshot: SharedSnapshot?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SnapshotEntry {
        SnapshotEntry(date: Date(), snapshot: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry) -> Void) {
        completion(SnapshotEntry(date: Date(), snapshot: SharedStore.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry>) -> Void) {
        let entry = SnapshotEntry(date: Date(), snapshot: SharedStore.load())
        // The app refreshes the shared snapshot on open; this is a fallback cadence.
        let next = Date().addingTimeInterval(30 * 60)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Entry view (routes by family)

struct NudgetWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    var entry: SnapshotEntry

    var body: some View {
        switch family {
        case .systemMedium:
            MediumRunwayView(snapshot: entry.snapshot)
        case .accessoryRectangular:
            AccessoryRectangularView(snapshot: entry.snapshot)
        case .accessoryInline:
            AccessoryInlineView(snapshot: entry.snapshot)
        case .accessoryCircular:
            AccessoryCircularView(snapshot: entry.snapshot)
        default:
            SmallRunwayView(snapshot: entry.snapshot)
        }
    }
}

// MARK: - Home-screen widgets (show amounts)

private struct SmallRunwayView: View {
    let snapshot: SharedSnapshot?

    var body: some View {
        if let s = snapshot, let safe = s.safeToSpend {
            VStack(alignment: .leading, spacing: 0) {
                RiskChip(risk: s.riskLevel)
                Spacer(minLength: 6)
                Text("Safe to spend").font(.caption2).foregroundStyle(.secondary)
                Text(Format.currency(safe))
                    .font(.title2.weight(.bold))
                    .foregroundStyle(RiskStyle.color(s.riskLevel))
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                if let days = s.daysUntilPayday {
                    Text("\(days)d to payday").font(.caption2).foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        } else {
            EmptyState()
        }
    }
}

private struct MediumRunwayView: View {
    let snapshot: SharedSnapshot?

    var body: some View {
        if let s = snapshot, let safe = s.safeToSpend {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 0) {
                    RiskChip(risk: s.riskLevel)
                    Spacer(minLength: 6)
                    Text("Safe to spend").font(.caption2).foregroundStyle(.secondary)
                    Text(Format.currency(safe))
                        .font(.system(size: 30, weight: .bold, design: .rounded))
                        .foregroundStyle(RiskStyle.color(s.riskLevel))
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                    if let days = s.daysUntilPayday {
                        Text("\(days)d to payday · \(Format.shortDate(s.paydayDate))")
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 8) {
                    stat("Spent today", Format.currency(s.spentToday))
                    stat("Bills", Format.currency(s.billsBeforePayday))
                    Spacer(minLength: 0)
                    Text(s.isStale ? "Stale" : Format.relativeUpdated(s.lastUpdatedAt))
                        .font(.caption2)
                        .foregroundStyle(s.isStale ? Color.orange : Color.secondary)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        } else {
            EmptyState()
        }
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .trailing, spacing: 1) {
            Text(label).font(.caption2).foregroundStyle(.secondary)
            Text(value).font(.subheadline.weight(.semibold))
        }
    }
}

// MARK: - Lock-screen accessories (privacy-safe: risk + payday, no amounts)

private struct AccessoryRectangularView: View {
    let snapshot: SharedSnapshot?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Label("Nudget", systemImage: RiskStyle.icon(snapshot?.riskLevel))
                .font(.headline)
                .widgetAccentable()
            if let s = snapshot, s.safeToSpend != nil {
                Text(RiskStyle.label(s.riskLevel))
                if let days = s.daysUntilPayday {
                    Text("\(days) days to payday").foregroundStyle(.secondary)
                }
            } else {
                Text("Open the app").foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

private struct AccessoryInlineView: View {
    let snapshot: SharedSnapshot?

    var body: some View {
        if let s = snapshot, s.safeToSpend != nil {
            Label(
                s.daysUntilPayday.map { "\(RiskStyle.label(s.riskLevel)) · \($0)d" }
                    ?? RiskStyle.label(s.riskLevel),
                systemImage: RiskStyle.icon(s.riskLevel)
            )
        } else {
            Label("Open Nudget", systemImage: "questionmark.circle")
        }
    }
}

private struct AccessoryCircularView: View {
    let snapshot: SharedSnapshot?

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 1) {
                Image(systemName: RiskStyle.icon(snapshot?.riskLevel))
                    .font(.headline)
                if let days = snapshot?.daysUntilPayday {
                    Text("\(days)d").font(.caption2)
                }
            }
            .widgetAccentable()
        }
    }
}

// MARK: - Shared bits

private struct RiskChip: View {
    let risk: String?
    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: RiskStyle.icon(risk))
            Text(RiskStyle.label(risk))
        }
        .font(.caption2.weight(.semibold))
        .foregroundStyle(RiskStyle.color(risk))
    }
}

private struct EmptyState: View {
    var body: some View {
        VStack(spacing: 4) {
            Text("Nudget").font(.caption.weight(.semibold))
            Text("Open the app").font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Widget

@main
struct NudgetWidget: Widget {
    private let kind = "NudgetWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            NudgetWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Runway")
        .description("Your safe-to-spend at a glance.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryRectangular,
            .accessoryInline,
            .accessoryCircular,
        ])
    }
}
