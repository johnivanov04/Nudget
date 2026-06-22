import Foundation

@MainActor
final class OnboardingViewModel: ObservableObject {
    enum Step {
        case privacy
        case payday
        case connectBank
    }

    @Published var step: Step = .privacy
    @Published var isWorking = false
    @Published var error: String?

    // Payday inputs
    @Published var frequency: PaydayFrequency = .biweekly
    @Published var lastPaycheckDate = Date()

    private let token: String
    private let api: NudgetAPI

    init(token: String, api: NudgetAPI = NudgetAPI()) {
        self.token = token
        self.api = api
    }

    func acceptPrivacy() async {
        isWorking = true
        error = nil
        do {
            try await api.acknowledgePrivacy(token: token)
            step = .payday
        } catch {
            self.error = message(error)
        }
        isWorking = false
    }

    func savePayday() async {
        isWorking = true
        error = nil
        do {
            try await api.savePaycheck(
                token: token,
                frequency: frequency.rawValue,
                lastPaycheckDate: Self.dayFormatter.string(from: lastPaycheckDate)
            )
            step = .connectBank
        } catch {
            self.error = message(error)
        }
        isWorking = false
    }

    private func message(_ error: Error) -> String {
        (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }

    /// Formats the picked date as a local calendar date ("yyyy-MM-dd").
    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
}
