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

    /// A guaranteed-fresh access token: refreshes proactively if the current one
    /// is expired or about to expire, so requests almost never hit a 401. Returns
    /// nil only if there's no session at all. This is the primary path; the
    /// reactive 401 retry in NudgetAPI stays as a backstop.
    func validAccessToken() async -> String? {
        let current = accessToken
        // Fresh enough → use as-is.
        if let current, !JWT.isExpired(current) { return current }
        // Expired/near-expiry but we have a refresh token → renew.
        if refreshToken != nil {
            let result = await refresh()
            if result == .refreshed { return accessToken }
            if result == .transient { return current } // let the request try + 401-retry
            return nil // .invalid → session ended
        }
        return current // no refresh token — return whatever we have (may 401 → signOut)
    }

    /// Proactively ensure the session is fresh (called on launch/foreground).
    func ensureFresh() async {
        _ = await validAccessToken()
    }

    /// Refresh the access token. Safe to call concurrently — a single refresh is
    /// shared. A transient (network/5xx) failure does NOT sign the user out.
    func refresh() async -> RefreshResult {
        if let inFlight { return await inFlight.value }
        let task = Task { () -> RefreshResult in
            defer { inFlight = nil }
            guard let refreshToken else {
                // No stored refresh token — a broken/legacy session. This is the
                // usual cause of "logged out constantly"; capture it distinctly.
                let reason = "no refresh token stored"
                SentrySDK.capture(message: "Token refresh skipped: \(reason)")
                AuthDiagnostics.record(signOutReason: reason)
                onInvalidated?()
                return .invalid
            }
            do {
                let session = try await auth.refresh(refreshToken: refreshToken)
                Keychain.set(session.accessToken, for: Self.accessAccount)
                if let newRefresh = session.refreshToken {
                    Keychain.set(newRefresh, for: Self.refreshAccount)
                } else {
                    SentrySDK.capture(message: "Refresh succeeded but returned no refresh_token")
                }
                onRefresh?(session)
                return .refreshed
            } catch {
                // Report the real reason so recurring logouts are diagnosable.
                let detail = Self.reasonString(from: error)
                SentrySDK.capture(message: "Token refresh failed: \(detail)")
                if AuthError.isDefinitiveAuthFailure(error) {
                    AuthDiagnostics.record(signOutReason: detail)
                    onInvalidated?() // refresh token truly rejected → end session
                    return .invalid
                }
                return .transient // network/server blip → keep session, fail this request
            }
        }
        inFlight = task
        return await task.value
    }

    /// A short, PII-free reason for a refresh failure (status + server code).
    private static func reasonString(from error: Error) -> String {
        if case let AuthError.server(status, message) = error {
            return "refresh rejected (HTTP \(status)): \(message)"
        }
        return "refresh error: \(error.localizedDescription)"
    }
}

/// A tiny store for the last auto-sign-out reason, shown on the sign-in screen so
/// recurring logouts are self-diagnosing without needing Sentry. Reason strings
/// are PII-free (status codes + server error codes, never tokens).
enum AuthDiagnostics {
    private static let key = "lastSignOutReason"

    static func record(signOutReason reason: String) {
        UserDefaults.standard.set(reason, forKey: key)
    }

    static var lastSignOutReason: String? {
        UserDefaults.standard.string(forKey: key)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
