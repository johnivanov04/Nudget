import Foundation

/// Supabase GoTrue session response (`/auth/v1/token`, and `/auth/v1/signup`
/// when email confirmation is disabled).
struct AuthSession: Decodable {
    let accessToken: String
    let refreshToken: String?
    let user: AuthUser?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case user
    }
}

struct AuthUser: Decodable {
    let id: String
    let email: String?
}

/// GoTrue error body. Different endpoints/versions use different keys, so we try
/// the common ones and fall back to a generic message.
struct AuthErrorBody: Decodable {
    let error: String?
    let errorDescription: String?
    let msg: String?
    let message: String?

    enum CodingKeys: String, CodingKey {
        case error
        case errorDescription = "error_description"
        case msg
        case message
    }

    var bestMessage: String {
        errorDescription ?? msg ?? message ?? error ?? "Sign-in failed."
    }
}
