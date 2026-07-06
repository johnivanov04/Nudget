import Foundation

@MainActor
final class AccountsViewModel: ObservableObject {
    @Published private(set) var accounts: [Account] = []
    @Published private(set) var banks: [LinkedBank] = []
    @Published private(set) var isLoading = true
    @Published private(set) var togglingIds: Set<String> = []
    @Published private(set) var disconnectingIds: Set<String> = []
    @Published var error: String?
    /// True once the user has changed something, so the caller can refresh.
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
            accounts = try await api.accounts(token: token)
            // Best-effort: don't fail the whole screen if the bank list errors.
            banks = (try? await api.linkedBanks(token: token)) ?? banks
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    /// Disconnect a linked bank (removes its accounts + transactions server-side,
    /// which recomputes the runway), then refresh the list.
    func disconnect(_ bank: LinkedBank) async {
        disconnectingIds.insert(bank.id)
        error = nil
        do {
            try await api.disconnectBank(token: token, itemId: bank.id)
            didChange = true
            await load()
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        disconnectingIds.remove(bank.id)
    }

    func setIncluded(_ account: Account, _ included: Bool) async {
        guard let index = accounts.firstIndex(where: { $0.id == account.id }) else { return }
        let previous = accounts[index].includedInRunway
        guard previous != included else { return }

        togglingIds.insert(account.id)
        accounts[index].includedInRunway = included // optimistic
        error = nil
        do {
            try await api.setAccountIncluded(token: token, accountId: account.id, included: included)
            didChange = true
        } catch {
            accounts[index].includedInRunway = previous // revert on failure
            self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        togglingIds.remove(account.id)
    }
}
