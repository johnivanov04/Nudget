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

    /// A still-valid access token from the shared keychain, or nil.
    ///
    /// The widget deliberately does NOT refresh the token itself: the app owns
    /// refresh, and having two processes rotate the same refresh token can trip
    /// Supabase's reuse detection and end the session. If the token is expired,
    /// we skip the fetch and the widget shows the last cached value until the app
    /// (which refreshes proactively on launch/foreground) freshens it.
    private static func validAccessToken() async -> String? {
        guard let access = Keychain.get(accessAccount), !JWT.isExpired(access) else { return nil }
        return access
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

