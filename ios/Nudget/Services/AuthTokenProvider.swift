import Foundation

/// Single source of truth for the auth tokens + silent refresh.
///
/// Supabase access tokens are short-lived (~1h). Instead of signing the user out
/// on the first 401, the API layer asks this provider to refresh using the stored
/// refresh token and retries the request once. Concurrent 401s share one refresh
/// (de-duplicated) so we don't fire a burst of refresh calls.
@MainActor
final class AuthTokenProvider {
    static let shared = AuthTokenProvider()

    static let accessAccount = "access_token"
    static let refreshAccount = "refresh_token"

    private let auth: AuthService
    private var inFlight: Task<Bool, Never>?

    /// Set by `SessionStore`: called with the new session after a successful
    /// refresh (to keep the published state's token current).
    var onRefresh: ((AuthSession) -> Void)?
    /// Set by `SessionStore`: called when refresh is impossible/rejected — the
    /// session is dead and the user must sign in again.
    var onInvalidated: (() -> Void)?

    init(auth: AuthService = AuthService()) {
        self.auth = auth
    }

    /// The current access token, straight from the Keychain (the freshest one).
    var accessToken: String? { Keychain.get(Self.accessAccount) }
    private var refreshToken: String? { Keychain.get(Self.refreshAccount) }

    /// Refresh the access token. Returns whether a valid token is now available.
    /// Safe to call concurrently — a single refresh is shared.
    func refreshIfPossible() async -> Bool {
        if let inFlight { return await inFlight.value }
        let task = Task { () -> Bool in
            defer { inFlight = nil }
            guard let refreshToken else {
                onInvalidated?()
                return false
            }
            do {
                let session = try await auth.refresh(refreshToken: refreshToken)
                Keychain.set(session.accessToken, for: Self.accessAccount)
                if let newRefresh = session.refreshToken {
                    Keychain.set(newRefresh, for: Self.refreshAccount)
                }
                onRefresh?(session)
                return true
            } catch {
                onInvalidated?()
                return false
            }
        }
        inFlight = task
        return await task.value
    }
}
