import Foundation

enum NudgetAPIError: LocalizedError {
    case invalidURL
    case badStatus(Int)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Could not build the request URL."
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
}
