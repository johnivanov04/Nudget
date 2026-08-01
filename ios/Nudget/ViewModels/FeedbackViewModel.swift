import Foundation

@MainActor
final class FeedbackViewModel: ObservableObject {
    /// The kinds of feedback a beta user can send. Raw values match the backend
    /// `feedbackSchema` eventType enum.
    enum Topic: String, CaseIterable, Identifiable {
        case savedFee = "saved_fee"
        case nudge = "nudge_helpful"
        case runway = "runway_confusing"
        case other = "other"

        var id: String { rawValue }
        var label: String {
            switch self {
            case .savedFee: return "I avoided a fee 🎉"
            case .nudge: return "A nudge"
            case .runway: return "The runway number"
            case .other: return "Something else"
            }
        }
        /// Only the nudge topic asks whether it was helpful.
        var asksHelpful: Bool { self == .nudge }
    }

    @Published var topic: Topic = .savedFee
    @Published var helpful = true
    @Published var note = ""
    @Published private(set) var isSending = false
    @Published private(set) var didSend = false
    @Published var error: String?

    private let token: String
    private let api: NudgetAPI

    init(token: String, api: NudgetAPI = NudgetAPI()) {
        self.token = token
        self.api = api
    }

    func submit() async {
        isSending = true
        error = nil
        defer { isSending = false }
        do {
            try await api.submitFeedback(
                token: token,
                eventType: topic.rawValue,
                rating: topic.asksHelpful ? (helpful ? 5 : 1) : nil,
                freeText: note.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            didSend = true
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}
