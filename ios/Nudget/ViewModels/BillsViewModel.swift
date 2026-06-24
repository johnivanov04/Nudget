import Foundation

@MainActor
final class BillsViewModel: ObservableObject {
    @Published private(set) var bills: [Bill] = []
    @Published private(set) var isLoading = true
    @Published private(set) var busyIds: Set<String> = []
    @Published var error: String?
    /// True once the user changed something, so the dashboard should refresh.
    @Published private(set) var didChange = false

    private let token: String
    private let api: NudgetAPI

    init(token: String, api: NudgetAPI = NudgetAPI()) {
        self.token = token
        self.api = api
    }

    func load() async {
        isLoading = true
        error = nil
        do {
            // Show confirmed first, then likely candidates by confidence.
            bills = try await api.bills(token: token).sorted { a, b in
                if a.isConfirmed != b.isConfirmed { return a.isConfirmed }
                return (a.confidence ?? 0) > (b.confidence ?? 0)
            }
        } catch {
            self.error = message(error)
        }
        isLoading = false
    }

    func confirm(_ bill: Bill) async { await update(bill, status: "confirmed") }
    func reject(_ bill: Bill) async { await update(bill, status: "rejected") }

    func edit(_ bill: Bill, amount: Double, nextDate: String) async {
        await update(bill, status: "confirmed", amount: amount, nextDate: nextDate)
    }

    private func update(_ bill: Bill, status: String, amount: Double? = nil, nextDate: String? = nil) async {
        busyIds.insert(bill.id)
        error = nil
        do {
            try await api.updateBill(
                token: token,
                billId: bill.id,
                status: status,
                amountEstimate: amount,
                nextExpectedDate: nextDate
            )
            didChange = true
            // Reflect the change locally without a full reload.
            if status == "rejected" {
                bills.removeAll { $0.id == bill.id }
            } else if let index = bills.firstIndex(where: { $0.id == bill.id }) {
                bills[index] = Bill(
                    id: bill.id,
                    merchantName: bill.merchantName,
                    amountEstimate: amount ?? bill.amountEstimate,
                    cadence: bill.cadence,
                    nextExpectedDate: nextDate ?? bill.nextExpectedDate,
                    confidence: bill.confidence,
                    status: "confirmed",
                    likely: false
                )
            }
        } catch {
            self.error = message(error)
        }
        busyIds.remove(bill.id)
    }

    private func message(_ error: Error) -> String {
        (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }
}
