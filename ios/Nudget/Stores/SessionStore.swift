import Foundation
import WidgetKit

/// Holds the auth state for the whole app. Persists the access token in the
/// Keychain so the session survives relaunches.
@MainActor
final class SessionStore: ObservableObject {
    enum State: Equatable {
        case loading
        case signedOut
        case signedIn(token: String, email: String?)
    }

    @Published private(set) var state: State = .loading

    var isSignedIn: Bool { if case .signedIn = state { return true } else { return false } }

    private let auth: AuthService
    private static let tokenAccount = AuthTokenProvider.accessAccount
    private static let refreshAccount = AuthTokenProvider.refreshAccount
    private static let emailAccount = "user_email"

    init(auth: AuthService = AuthService()) {
        self.auth = auth

        // Silent-refresh wiring: keep the published token current on refresh, and
        // sign out only when the refresh token itself is dead.
        AuthTokenProvider.shared.onRefresh = { [weak self] session in
            // Mirror the fresh token to the App Group so the widget can fetch.
            SharedStore.saveAccessToken(session.accessToken)
            guard let self, case let .signedIn(_, email) = self.state else { return }
            self.state = .signedIn(token: session.accessToken, email: email)
        }
        AuthTokenProvider.shared.onInvalidated = { [weak self] in
            self?.signOut()
        }
    }

    /// Restore a stored session on launch (optimistic — an expired token is
    /// caught on the first 401 and signs the user out).
    private static let hasSignedInKey = "hasSignedInBefore"

    func restore() {
        if let token = Keychain.get(Self.tokenAccount) {
            state = .signedIn(token: token, email: Keychain.get(Self.emailAccount))
            SharedStore.saveAccessToken(token) // mirror for the widget
            PushManager.shared.onSignedIn(token: token)
            // Proactively refresh a stale token on launch (while online), so the
            // first real request doesn't 401 and the session stays alive.
            Task { await AuthTokenProvider.shared.ensureFresh() }
        } else {
            // If we've signed in before but the keychain has no token, the token
            // was lost (e.g. a keychain access-group/entitlement change) — not a
            // normal fresh install. Record it so the sign-in screen shows why.
            if UserDefaults.standard.bool(forKey: Self.hasSignedInKey) {
                AuthDiagnostics.record(signOutReason: "session lost on launch — keychain token not found")
            }
            state = .signedOut
        }
    }

    func signIn(email: String, password: String) async throws {
        let session = try await auth.signIn(email: email, password: password)
        persist(session, fallbackEmail: email)
    }

    func signUp(email: String, password: String) async throws {
        let session = try await auth.signUp(email: email, password: password)
        persist(session, fallbackEmail: email)
    }

    func signInWithApple(idToken: String, nonce: String, fallbackEmail: String?) async throws {
        let session = try await auth.signInWithApple(idToken: idToken, nonce: nonce)
        persist(session, fallbackEmail: fallbackEmail ?? "")
    }

    func signOut() {
        Keychain.delete(Self.tokenAccount)
        Keychain.delete(Self.refreshAccount)
        Keychain.delete(Self.emailAccount)
        SharedStore.clear()
        WidgetCenter.shared.reloadAllTimelines()
        PushManager.shared.onSignedOut()
        state = .signedOut
    }

    private func persist(_ session: AuthSession, fallbackEmail: String) {
        AuthDiagnostics.clear() // fresh session — drop any stale sign-out reason
        UserDefaults.standard.set(true, forKey: Self.hasSignedInKey)
        let email = session.user?.email ?? fallbackEmail
        // Verify the token actually persisted — a silently-failed keychain write
        // manifests as "logged out on next launch", so surface it if it happens.
        let stored = Keychain.set(session.accessToken, for: Self.tokenAccount)
        if !stored {
            AuthDiagnostics.record(signOutReason: "keychain write failed at sign-in")
        }
        if let refreshToken = session.refreshToken {
            Keychain.set(refreshToken, for: Self.refreshAccount)
        }
        Keychain.set(email, for: Self.emailAccount)
        SharedStore.saveAccessToken(session.accessToken) // mirror for the widget
        state = .signedIn(token: session.accessToken, email: email)
        PushManager.shared.onSignedIn(token: session.accessToken)
    }
}
