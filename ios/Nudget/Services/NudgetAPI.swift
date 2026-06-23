import Foundation

enum NudgetAPIError: LocalizedError {
    case invalidURL
    case unauthorized
    case badStatus(Int)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Could not build the request URL."
        case .unauthorized: return "Your session expired. Please sign in again."
        case .badStatus(let code): return "The server responded with status \(code)."
        case .decoding: return "Couldn't read the server's response."
        case .transport(let error): return error.localizedDescription
        }
    }
}

/// Thin client for the Nudget backend. This first slice only needs the demo
/// snapshot endpoint (no auth). Auth + Plaid endpoints come in the next slice.
struct NudgetAPI {
    var baseURL: URL = AppConfig.baseURL
    var session: URLSession = .shared

    /// `GET /api/widget/snapshot?demo=1[&privacy=1]` — runway snapshot from seed data.
    func demoSnapshot(privacyMode: Bool = false) async throws -> WidgetSnapshot {
        var components = URLComponents(
            url: baseURL.appendingPathComponent("api/widget/snapshot"),
            resolvingAgainstBaseURL: false
        )
        var query = [URLQueryItem(name: "demo", value: "1")]
        if privacyMode { query.append(URLQueryItem(name: "privacy", value: "1")) }
        components?.queryItems = query
        guard let url = components?.url else { throw NudgetAPIError.invalidURL }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(from: url)
        } catch {
            throw NudgetAPIError.transport(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw NudgetAPIError.badStatus(-1)
        }
        guard (200..<300).contains(http.statusCode) else {
            throw NudgetAPIError.badStatus(http.statusCode)
        }

        do {
            return try JSONDecoder().decode(WidgetSnapshotResponse.self, from: data).widget
        } catch {
            throw NudgetAPIError.decoding(error)
        }
    }

    /// `GET /api/runway/current` — the authenticated user's latest runway snapshot.
    func runwayCurrent(token: String) async throws -> RunwayCurrentResponse {
        let url = baseURL.appendingPathComponent("api/runway/current")
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw NudgetAPIError.transport(error)
        }

        guard let http = response as? HTTPURLResponse else { throw NudgetAPIError.badStatus(-1) }
        if http.statusCode == 401 { throw NudgetAPIError.unauthorized }
        guard (200..<300).contains(http.statusCode) else {
            throw NudgetAPIError.badStatus(http.statusCode)
        }

        do {
            return try JSONDecoder().decode(RunwayCurrentResponse.self, from: data)
        } catch {
            throw NudgetAPIError.decoding(error)
        }
    }

    /// `GET /api/accounts` — the user's linked accounts.
    func accounts(token: String) async throws -> [Account] {
        let data = try await getAuthed(path: "api/accounts", token: token)
        do {
            return try JSONDecoder().decode(AccountsResponse.self, from: data).accounts
        } catch {
            throw NudgetAPIError.decoding(error)
        }
    }

    /// `POST /api/accounts/:id/included` — toggle whether an account counts toward
    /// the runway. The server recomputes the runway as part of this call.
    func setAccountIncluded(token: String, accountId: String, included: Bool) async throws {
        _ = try await postAuthed(
            path: "api/accounts/\(accountId)/included",
            token: token,
            body: ["included": included]
        )
    }

    /// `GET /api/onboarding/status` — which onboarding steps are complete.
    func onboardingStatus(token: String) async throws -> OnboardingStatus {
        let data = try await getAuthed(path: "api/onboarding/status", token: token)
        do {
            return try JSONDecoder().decode(OnboardingStatus.self, from: data)
        } catch {
            throw NudgetAPIError.decoding(error)
        }
    }

    /// `POST /api/plaid/link-token` — short-lived token to open Plaid Link.
    func createLinkToken(token: String) async throws -> String {
        let data = try await postAuthed(path: "api/plaid/link-token", token: token, body: [:])
        do {
            return try JSONDecoder().decode(LinkTokenResponse.self, from: data).linkToken
        } catch {
            throw NudgetAPIError.decoding(error)
        }
    }

    /// `POST /api/plaid/exchange-public-token` — store the linked item server-side.
    func exchangePublicToken(token: String, publicToken: String) async throws {
        _ = try await postAuthed(
            path: "api/plaid/exchange-public-token",
            token: token,
            body: ["publicToken": publicToken]
        )
    }

    /// `POST /api/plaid/sync` — pull transactions, detect bills, recompute runway.
    func syncTransactions(token: String) async throws {
        _ = try await postAuthed(path: "api/plaid/sync", token: token, body: [:])
    }

    /// `POST /api/onboarding/privacy` — record the privacy acknowledgement.
    func acknowledgePrivacy(token: String) async throws {
        _ = try await postAuthed(path: "api/onboarding/privacy", token: token, body: [:])
    }

    /// `POST /api/onboarding/paycheck` — save the pay schedule.
    func savePaycheck(
        token: String,
        frequency: String,
        lastPaycheckDate: String,
        weekendRule: String = "none"
    ) async throws {
        _ = try await postAuthed(
            path: "api/onboarding/paycheck",
            token: token,
            body: [
                "frequency": frequency,
                "lastPaycheckDate": lastPaycheckDate,
                "weekendRule": weekendRule,
            ]
        )
    }

    private func getAuthed(path: String, token: String) async throws -> Data {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw NudgetAPIError.transport(error)
        }
        guard let http = response as? HTTPURLResponse else { throw NudgetAPIError.badStatus(-1) }
        if http.statusCode == 401 { throw NudgetAPIError.unauthorized }
        guard (200..<300).contains(http.statusCode) else {
            throw NudgetAPIError.badStatus(http.statusCode)
        }
        return data
    }

    @discardableResult
    private func postAuthed(path: String, token: String, body: [String: Any]) async throws -> Data {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw NudgetAPIError.transport(error)
        }

        guard let http = response as? HTTPURLResponse else { throw NudgetAPIError.badStatus(-1) }
        if http.statusCode == 401 { throw NudgetAPIError.unauthorized }
        guard (200..<300).contains(http.statusCode) else {
            throw NudgetAPIError.badStatus(http.statusCode)
        }
        return data
    }
}
