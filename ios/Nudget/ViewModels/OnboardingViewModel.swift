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

    /// Non-nil while Plaid Link should be presented.
    @Published var linkToken: String?

    private let token: String
    private let api: NudgetAPI
    private let onComplete: () -> Void

    init(token: String, api: NudgetAPI = NudgetAPI(), onComplete: @escaping () -> Void) {
        self.token = token
        self.api = api
        self.onComplete = onComplete
    }

    /// Resume onboarding at the first incomplete step.
    func start() async {
        do {
            let status = try await api.onboardingStatus(token: token)
            if !status.privacyAcknowledged {
                step = .privacy
            } else if !status.hasPaydaySchedule {
                step = .payday
            } else {
                step = .connectBank
            }
        } catch {
            step = .privacy // safe default
        }
    }

    func acceptPrivacy() async {
        await run {
            try await self.api.acknowledgePrivacy(token: self.token)
            self.step = .payday
        }
    }

    func savePayday() async {
        await run {
            try await self.api.savePaycheck(
                token: self.token,
                frequency: self.frequency.rawValue,
                lastPaycheckDate: Self.dayFormatter.string(from: self.lastPaycheckDate)
            )
            self.step = .connectBank
        }
    }

    /// Fetch a link token and trigger the Plaid Link sheet.
    func beginLink() async {
        await run {
            self.linkToken = try await self.api.createLinkToken(token: self.token)
        }
    }

    /// Plaid returned a public token — exchange + sync, then finish onboarding.
    func linkSucceeded(publicToken: String) async {
        linkToken = nil
        await run {
            try await self.api.exchangePublicToken(token: self.token, publicToken: publicToken)
            try await self.api.syncTransactions(token: self.token)
            self.onComplete()
        }
    }

    func linkExited(error message: String?) {
        linkToken = nil
        if let message { error = message }
    }

    func skip() {
        onComplete()
    }

    private func run(_ work: @escaping () async throws -> Void) async {
        isWorking = true
        error = nil
        do {
            try await work()
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        isWorking = false
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
}
