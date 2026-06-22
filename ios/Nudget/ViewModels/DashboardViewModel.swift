import Foundation

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
            } else {
                state = .needsSetup
            }
        } catch NudgetAPIError.unauthorized {
            state = .unauthorized
        } catch {
            state = .failed((error as? LocalizedError)?.errorDescription ?? error.localizedDescription)
        }
    }
}
