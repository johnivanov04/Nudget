import Foundation

@MainActor
final class DashboardViewModel: ObservableObject {
    enum State: Equatable {
        case loading
        case loaded(WidgetSnapshot)
        case failed(String)
    }

    @Published private(set) var state: State = .loading
    @Published var privacyMode = false {
        didSet { Task { await load() } }
    }

    private let api: NudgetAPI

    init(api: NudgetAPI = NudgetAPI()) {
        self.api = api
    }

    func load() async {
        state = .loading
        do {
            let snapshot = try await api.demoSnapshot(privacyMode: privacyMode)
            state = .loaded(snapshot)
        } catch {
            state = .failed((error as? LocalizedError)?.errorDescription ?? error.localizedDescription)
        }
    }
}
