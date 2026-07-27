import Foundation

/// Lets the widget extension fetch a fresh runway snapshot directly from the
/// backend on its own WidgetKit schedule — so the widget stays current even if
/// the app hasn't been opened. Reads the auth token from the shared keychain,
/// refreshes it via Supabase if it's expired, then calls `/api/widget/snapshot`.
/// Returns nil on any failure so the widget falls back to the last cached value.
enum WidgetData {
    private static let accessAccount = "access_token"
    private static let refreshAccount = "refresh_token"

    static func fetchLatest() async -> SharedSnapshot? {
        guard let token = await validAccessToken() else { return nil }

        var request = URLRequest(url: AppConfig.baseURL.appendingPathComponent("api/widget/snapshot"))
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let decoded = try? JSONDecoder().decode(WidgetResponse.self, from: data),
              let w = decoded.widget
        else { return nil }

        let snapshot = SharedSnapshot(
            status: w.status,
            safeToSpend: w.safeToSpend,
            spentToday: w.spentToday,
            billsBeforePayday: w.billsBeforePayday,
            riskLevel: w.riskLevel,
            paydayDate: w.paydayDate,
            daysUntilPayday: w.daysUntilPayday,
            lastUpdatedAt: w.lastUpdatedAt,
            isStale: w.isStale
        )
        SharedStore.save(snapshot) // keep the shared cache current too
        return snapshot
    }

    /// A valid access token from the shared keychain, refreshing via Supabase if
    /// the current one is expired. Nil if there's no session.
    private static func validAccessToken() async -> String? {
        guard let access = Keychain.get(accessAccount) else { return nil }
        if !JWT.isExpired(access) { return access }
        guard let refresh = Keychain.get(refreshAccount) else { return access }
        return await refreshed(using: refresh) ?? access
    }

    private static func refreshed(using refreshToken: String) async -> String? {
        var comps = URLComponents(
            url: Secrets.supabaseURL.appendingPathComponent("auth/v1/token"),
            resolvingAgainstBaseURL: false
        )
        comps?.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
        guard let url = comps?.url else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(Secrets.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])
        request.timeoutInterval = 15

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let session = try? JSONDecoder().decode(RefreshResponse.self, from: data)
        else { return nil }

        Keychain.set(session.accessToken, for: accessAccount)
        if let newRefresh = session.refreshToken {
            Keychain.set(newRefresh, for: refreshAccount)
        }
        return session.accessToken
    }
}

// MARK: - Decodables

private struct WidgetResponse: Decodable {
    let widget: Widget?
    struct Widget: Decodable {
        let status: String
        let safeToSpend: Double?
        let spentToday: Double?
        let billsBeforePayday: Double?
        let riskLevel: String?
        let paydayDate: String?
        let daysUntilPayday: Int?
        let lastUpdatedAt: String?
        let isStale: Bool
    }
}

private struct RefreshResponse: Decodable {
    let accessToken: String
    let refreshToken: String?
    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
    }
}
