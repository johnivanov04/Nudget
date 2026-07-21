import Foundation
import WidgetKit

@MainActor
final class DashboardViewModel: ObservableObject {
    enum State: Equatable {
        case loading
        case loaded(RunwaySnapshotView)
        case needsSetup
        case unauthorized
        case failed(String)
    }

    @Published private(set) var state: State = .loading
    /// Confirmed bills due on or before payday — the dashboard "upcoming" peek.
    @Published private(set) var upcomingBills: [Bill] = []
    /// Linked banks whose connection needs re-auth (drives the reconnect banner).
    @Published private(set) var reconnectBanks: [LinkedBank] = []

    private let api: NudgetAPI
    private let token: String

    init(token: String, api: NudgetAPI = NudgetAPI()) {
        self.token = token
        self.api = api
    }

    func load() async {
        state = .loading
        do {
            let response = try await api.runwayCurrent(token: token)
            if let snapshot = response.snapshot, !snapshot.needsData {
                state = .loaded(snapshot)
                publishToWidget(snapshot)
                await loadUpcomingBills(before: snapshot.paydayDate)
                // Best-effort: surface banks that need re-auth.
                reconnectBanks = ((try? await api.linkedBanks(token: token)) ?? [])
                    .filter { $0.needsReconnect }
            } else {
                upcomingBills = []
                reconnectBanks = []
                state = .needsSetup
            }
        } catch NudgetAPIError.unauthorized {
            state = .unauthorized
        } catch {
            state = .failed((error as? LocalizedError)?.errorDescription ?? error.localizedDescription)
        }
    }

    /// Fetch confirmed bills due on or before payday (best-effort — a failure
    /// here shouldn't break the dashboard). ISO `yyyy-MM-dd` strings sort/compare
    /// chronologically, so string comparison is safe.
    private func loadUpcomingBills(before payday: String?) async {
        guard let payday else { upcomingBills = []; return }
        let all: [Bill] = (try? await api.bills(token: token)) ?? []
        let due: [Bill] = all.filter { bill in
            guard bill.isConfirmed, let date = bill.nextExpectedDate else { return false }
            return date <= payday
        }
        let sorted: [Bill] = due.sorted { lhs, rhs in
            (lhs.nextExpectedDate ?? "") < (rhs.nextExpectedDate ?? "")
        }
        upcomingBills = Array(sorted.prefix(3))
    }

    /// Mirror the latest snapshot into the App Group + refresh the widget.
    private func publishToWidget(_ snapshot: RunwaySnapshotView) {
        SharedStore.save(
            SharedSnapshot(
                status: snapshot.status,
                safeToSpend: snapshot.safeToSpend,
                spentToday: snapshot.spentToday,
                billsBeforePayday: snapshot.billsBeforePayday,
                riskLevel: snapshot.riskLevel,
                paydayDate: snapshot.paydayDate,
                daysUntilPayday: snapshot.daysUntilPayday,
                lastUpdatedAt: snapshot.lastUpdatedAt,
                isStale: snapshot.isStale
            )
        )
        WidgetCenter.shared.reloadAllTimelines()
    }
}
