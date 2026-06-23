import Foundation

/// `GET /api/onboarding/status` — which onboarding steps are done.
struct OnboardingStatus: Decodable {
    let privacyAcknowledged: Bool
    let hasPaydaySchedule: Bool
    let hasLinkedBank: Bool
    let complete: Bool
}

/// `POST /api/plaid/link-token` response.
struct LinkTokenResponse: Decodable {
    let linkToken: String
}
