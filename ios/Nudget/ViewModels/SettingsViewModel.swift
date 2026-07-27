import Foundation

@MainActor
final class SettingsViewModel: ObservableObject {
    @Published var prefs = NotificationPreferences.fallback
    @Published var safetyBuffer: Double = 0
    @Published private(set) var isLoading = true
    @Published private(set) var isDeleting = false
    @Published private(set) var isSendingTest = false
    @Published var testResult: String?
    @Published var error: String?

    let toneOptions = ["gentle", "direct", "minimal"]

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
            prefs = try await api.notificationPreferences(token: token)
            // Best-effort: don't fail the whole screen if this errors.
            safetyBuffer = (try? await api.safetyBuffer(token: token)) ?? safetyBuffer
        } catch {
            self.error = message(error)
        }
        isLoading = false
    }

    /// Persist the safety buffer (server recomputes the runway).
    func saveSafetyBuffer() async {
        do {
            try await api.saveSafetyBuffer(token: token, max(0, safetyBuffer))
        } catch {
            self.error = message(error)
        }
    }

    /// Persist the current preferences (debounce-free; called on change/commit).
    func save() async {
        do {
            prefs = try await api.updateNotificationPreferences(token: token, prefs)
        } catch {
            self.error = message(error)
        }
    }

    /// Send a real test push to this user's registered devices.
    func sendTestNudge() async {
        isSendingTest = true
        testResult = nil
        error = nil
        defer { isSendingTest = false }
        do {
            let delivered = try await api.sendTestPush(token: token)
            testResult = delivered > 0
                ? "Sent to \(delivered) device\(delivered == 1 ? "" : "s")."
                : "Nothing delivered — allow notifications, then reopen the app so it can register."
        } catch {
            self.error = message(error)
        }
    }

    /// Delete the account. On success the caller should sign out.
    func deleteAccount() async -> Bool {
        isDeleting = true
        error = nil
        defer { isDeleting = false }
        do {
            try await api.deleteAccount(token: token)
            return true
        } catch {
            self.error = message(error)
            return false
        }
    }

    private func message(_ error: Error) -> String {
        (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }
}
