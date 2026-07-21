import Foundation
import Sentry

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

    /// Outcome of a refresh attempt. Only `.invalid` should end the session.
    enum RefreshResult { case refreshed, invalid, transient }

    private let auth: AuthService
    private var inFlight: Task<RefreshResult, Never>?

    /// Set by `SessionStore`: called with the new session after a successful
    /// refresh (to keep the published state's token current).
    var onRefresh: ((AuthSession) -> Void)?
    /// Set by `SessionStore`: called only when the refresh token is genuinely
    /// rejected — the session is dead and the user must sign in again.
    var onInvalidated: (() -> Void)?

    init(auth: AuthService = AuthService()) {
        self.auth = auth
    }

    /// The current access token, straight from the Keychain (the freshest one).
    var accessToken: String? { Keychain.get(Self.accessAccount) }
    private var refreshToken: String? { Keychain.get(Self.refreshAccount) }

    /// Refresh the access token. Safe to call concurrently — a single refresh is
    /// shared. A transient (network/5xx) failure does NOT sign the user out.
    func refresh() async -> RefreshResult {
        if let inFlight { return await inFlight.value }
        let task = Task { () -> RefreshResult in
            defer { inFlight = nil }
            guard let refreshToken else {
                onInvalidated?()
                return .invalid
            }
            do {
                let session = try await auth.refresh(refreshToken: refreshToken)
                Keychain.set(session.accessToken, for: Self.accessAccount)
                if let newRefresh = session.refreshToken {
                    Keychain.set(newRefresh, for: Self.refreshAccount)
                }
                onRefresh?(session)
                return .refreshed
            } catch {
                // Report the real reason so recurring logouts are diagnosable.
                SentrySDK.capture(message: "Token refresh failed: \(error.localizedDescription)")
                if AuthError.isDefinitiveAuthFailure(error) {
                    onInvalidated?() // refresh token truly rejected → end session
                    return .invalid
                }
                return .transient // network/server blip → keep session, fail this request
            }
        }
        inFlight = task
        return await task.value
    }
}
