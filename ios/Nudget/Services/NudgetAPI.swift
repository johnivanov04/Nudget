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

    @discardableResult
    private func postAuthed(path: String, token: String, body: [String: String]) async throws -> Data {
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
