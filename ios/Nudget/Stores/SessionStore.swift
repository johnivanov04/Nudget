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

    private let auth: AuthService
    private static let tokenAccount = AuthTokenProvider.accessAccount
    private static let refreshAccount = AuthTokenProvider.refreshAccount
    private static let emailAccount = "user_email"

    init(auth: AuthService = AuthService()) {
        self.auth = auth

        // Silent-refresh wiring: keep the published token current on refresh, and
        // sign out only when the refresh token itself is dead.
        AuthTokenProvider.shared.onRefresh = { [weak self] session in
            guard let self, case let .signedIn(_, email) = self.state else { return }
            self.state = .signedIn(token: session.accessToken, email: email)
        }
        AuthTokenProvider.shared.onInvalidated = { [weak self] in
            self?.signOut()
        }
    }

    /// Restore a stored session on launch (optimistic — an expired token is
    /// caught on the first 401 and signs the user out).
    func restore() {
        if let token = Keychain.get(Self.tokenAccount) {
            state = .signedIn(token: token, email: Keychain.get(Self.emailAccount))
            PushManager.shared.onSignedIn(token: token)
        } else {
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
        let email = session.user?.email ?? fallbackEmail
        Keychain.set(session.accessToken, for: Self.tokenAccount)
        if let refreshToken = session.refreshToken {
            Keychain.set(refreshToken, for: Self.refreshAccount)
        }
        Keychain.set(email, for: Self.emailAccount)
        state = .signedIn(token: session.accessToken, email: email)
        PushManager.shared.onSignedIn(token: session.accessToken)
    }
}
