import Foundation

enum AuthError: LocalizedError {
    case invalidURL
    case server(status: Int, message: String)
    case needsEmailConfirmation
    case transport(Error)
    case decoding

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Could not build the request."
        case .server(_, let message): return message
        case .needsEmailConfirmation: return "Check your email to confirm your account, then sign in."
        case .transport(let error): return error.localizedDescription
        case .decoding: return "Unexpected response from the server."
        }
    }

    /// A definitive rejection (bad credentials / invalid refresh token) vs a
    /// transient failure (network, server 5xx). Only definitive failures should
    /// end the session — a blip must not sign the user out.
    static func isDefinitiveAuthFailure(_ error: Error) -> Bool {
        if case let AuthError.server(status, _) = error {
            return (400..<500).contains(status)
        }
        return false // transport / decoding → transient, keep the session
    }
}

/// Talks directly to Supabase GoTrue for email/password auth. Returns the access
/// token (a JWT) which the app then sends to the Nudget backend.
struct AuthService {
    var baseURL: URL = Secrets.supabaseURL
    var anonKey: String = Secrets.supabaseAnonKey
    var session: URLSession = .shared

    func signIn(email: String, password: String) async throws -> AuthSession {
        try await authRequest(
            path: "auth/v1/token",
            query: [URLQueryItem(name: "grant_type", value: "password")],
            body: ["email": email, "password": password]
        )
    }

    /// Exchange a refresh token for a fresh access token (silent renewal).
    func refresh(refreshToken: String) async throws -> AuthSession {
        try await authRequest(
            path: "auth/v1/token",
            query: [URLQueryItem(name: "grant_type", value: "refresh_token")],
            body: ["refresh_token": refreshToken]
        )
    }

    /// Sign up. If the project has email confirmation enabled, no session is
    /// returned — surface `.needsEmailConfirmation`.
    func signUp(email: String, password: String) async throws -> AuthSession {
        do {
            return try await authRequest(
                path: "auth/v1/signup",
                query: [],
                body: ["email": email, "password": password]
            )
        } catch AuthError.decoding {
            // Signup succeeded but returned a user without a session.
            throw AuthError.needsEmailConfirmation
        }
    }

    private func authRequest(
        path: String,
        query: [URLQueryItem],
        body: [String: String]
    ) async throws -> AuthSession {
        var components = URLComponents(
            url: baseURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        )
        if !query.isEmpty { components?.queryItems = query }
        guard let url = components?.url else { throw AuthError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw AuthError.transport(error)
        }

        guard let http = response as? HTTPURLResponse else { throw AuthError.decoding }
        guard (200..<300).contains(http.statusCode) else {
            if let body = try? JSONDecoder().decode(AuthErrorBody.self, from: data) {
                throw AuthError.server(status: http.statusCode, message: body.bestMessage)
            }
            throw AuthError.server(
                status: http.statusCode,
                message: "Request failed (status \(http.statusCode)).",
            )
        }

        guard let session = try? JSONDecoder().decode(AuthSession.self, from: data) else {
            throw AuthError.decoding
        }
        return session
    }
}
