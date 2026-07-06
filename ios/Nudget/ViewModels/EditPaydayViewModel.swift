import Foundation

@MainActor
final class EditPaydayViewModel: ObservableObject {
    @Published var frequency: PaydayFrequency = .biweekly
    @Published var lastPaycheckDate: Date = Date()
    @Published private(set) var isLoading = true
    @Published private(set) var isSaving = false
    @Published var error: String?

    private let token: String
    private let api: NudgetAPI

    init(token: String, api: NudgetAPI = NudgetAPI()) {
        self.token = token
        self.api = api
    }

    /// Load the current schedule and prefill the controls.
    func load() async {
        isLoading = true
        error = nil
        do {
            if let schedule = try await api.paycheckSchedule(token: token) {
                if let freq = PaydayFrequency(rawValue: schedule.frequency) {
                    frequency = freq
                }
                if let last = schedule.lastPaycheckDate, let date = Self.parse(last) {
                    lastPaycheckDate = date
                }
            }
        } catch {
            self.error = message(error)
        }
        isLoading = false
    }

    /// Save the edited schedule. Returns true on success.
    func save() async -> Bool {
        isSaving = true
        error = nil
        defer { isSaving = false }
        do {
            try await api.savePaycheck(
                token: token,
                frequency: frequency.rawValue,
                lastPaycheckDate: Self.format(lastPaycheckDate)
            )
            return true
        } catch {
            self.error = message(error)
            return false
        }
    }

    private func message(_ error: Error) -> String {
        (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }

    private static func parse(_ iso: String) -> Date? { formatter.date(from: iso) }
    private static func format(_ date: Date) -> String { formatter.string(from: date) }

    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
}
