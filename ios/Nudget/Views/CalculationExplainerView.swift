import SwiftUI

/// "How this is calculated" — shows exactly how the safe-to-spend number is
/// derived, so users trust it (the spec's launch gate: if users don't trust the
/// number, fix calculation transparency before marketing).
///
/// All inputs come from the snapshot the dashboard already has. The safety buffer
/// isn't stored on the snapshot, but the formula is exact, so we derive it:
///   safeToSpend = availableCash − billsBeforePayday − safetyBuffer
///   ⇒ safetyBuffer = availableCash − billsBeforePayday − safeToSpend
struct CalculationExplainerView: View {
    let snapshot: RunwaySnapshotView
    @Environment(\.dismiss) private var dismiss

    private var availableCash: Double { snapshot.availableCash ?? 0 }
    private var bills: Double { snapshot.billsBeforePayday }
    private var safeToSpend: Double { snapshot.safeToSpend ?? 0 }
    private var safetyBuffer: Double { max(0, availableCash - bills - safeToSpend) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    intro

                    // The waterfall: cash → minus bills → minus buffer → safe to spend.
                    VStack(spacing: 0) {
                        row("Available cash", availableCash, system: "banknote", tint: Theme.brand,
                            note: "Money in your included accounts")
                        Divider().padding(.leading, 52)
                        row("Bills before payday", -bills, system: "calendar", tint: Theme.risk(.caution),
                            note: "Confirmed + likely bills due before payday")
                        if safetyBuffer > 0 {
                            Divider().padding(.leading, 52)
                            row("Safety buffer", -safetyBuffer, system: "shield.lefthalf.filled", tint: Theme.risk(.safe),
                                note: "A cushion you set aside in Settings")
                        }
                        Divider().padding(.leading, 52)
                        totalRow
                    }
                    .card(padding: 8)

                    dailyCard
                    footer
                }
                .padding(20)
            }
            .background(Theme.canvas)
            .navigationTitle("How this is calculated")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private var intro: some View {
        Text("Your safe-to-spend is what's left after the bills coming up before payday and your safety buffer.")
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func row(_ label: String, _ amount: Double, system: String, tint: Color, note: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: system)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(tint)
                .frame(width: 32, height: 32)
                .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.subheadline.weight(.medium))
                Text(note).font(.caption2).foregroundStyle(.secondary)
            }
            Spacer()
            Text(signed(amount))
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(amount < 0 ? .primary : .primary)
        }
        .padding(12)
    }

    private var totalRow: some View {
        HStack(spacing: 12) {
            Image(systemName: "equal")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Theme.risk(snapshot.risk))
                .frame(width: 32, height: 32)
                .background(Theme.risk(snapshot.risk).opacity(0.12), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            Text("Safe to spend").font(.subheadline.weight(.bold))
            Spacer()
            Text(Format.currency(safeToSpend))
                .font(.title3.weight(.bold))
                .monospacedDigit()
                .foregroundStyle(Theme.risk(snapshot.risk))
        }
        .padding(12)
    }

    private var dailyCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let daily = snapshot.dailySafeSpend, let days = snapshot.daysUntilPayday {
                Text("That's about **\(Format.currency(daily))/day** for the \(days) day\(days == 1 ? "" : "s") until payday (\(Format.shortDate(snapshot.paydayDate))).")
                    .font(.subheadline)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(padding: 16)
    }

    private var footer: some View {
        VStack(spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: snapshot.isStale ? "clock.badge.exclamationmark" : "checkmark.seal.fill")
                Text(snapshot.isStale ? "Data may be out of date — pull to refresh." : Format.relativeUpdated(snapshot.lastUpdatedAt))
            }
            .font(.caption)
            .foregroundStyle(snapshot.isStale ? Theme.risk(.caution) : Color.secondary)

            Text("Estimates for awareness, not financial advice. Numbers update as your bank data syncs.")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    /// A signed currency string ("+$X" style — negatives already carry the minus).
    private func signed(_ amount: Double) -> String {
        amount < 0 ? "− \(Format.currency(-amount))" : Format.currency(amount)
    }
}
