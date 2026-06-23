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
        // The app refreshes the shared snapshot whenever it's opened; this is just
        // a fallback cadence so the "updated … ago" text doesn't go too stale.
        let next = Date().addingTimeInterval(30 * 60)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct NudgetWidgetEntryView: View {
    var entry: SnapshotEntry

    var body: some View {
        if let snapshot = entry.snapshot, let safe = snapshot.safeToSpend {
            VStack(alignment: .leading, spacing: 2) {
                Text("Safe to spend")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(safe.formatted(.currency(code: "USD")))
                    .font(.title2.weight(.bold))
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                if let days = snapshot.daysUntilPayday {
                    Text("\(days)d to payday")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        } else {
            VStack(spacing: 4) {
                Text("Nudget").font(.caption.weight(.semibold))
                Text("Open the app").font(.caption2).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

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
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
