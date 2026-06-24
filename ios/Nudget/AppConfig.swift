import Foundation

/// App-wide configuration. For now just the backend base URL.
///
/// Points at the deployed production backend. To develop against a local server,
/// swap in `http://localhost:3000` (Simulator) or your Mac's LAN IP on a device
/// — and make sure Secrets.swift points at the matching Supabase project, since
/// the backend validates the JWT against its own project's secret.
enum AppConfig {
    static let baseURL = URL(string: "https://nudget-taupe.vercel.app")!
}
