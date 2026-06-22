import Foundation

enum Format {
    /// `$1,234.56` (USD). Returns "—" for nil.
    static func currency(_ value: Double?) -> String {
        guard let value else { return "—" }
        return value.formatted(.currency(code: "USD"))
    }

    /// "Jul 3" from a "YYYY-MM-DD" string.
    static func shortDate(_ iso: String?) -> String {
        guard let iso, let date = isoDayParser.date(from: iso) else { return "—" }
        return dayMonthFormatter.string(from: date)
    }

    /// "Updated 2h ago" from an ISO-8601 datetime string. Handles both the mock's
    /// 3-digit fractional seconds ("…000Z") and Postgres microseconds ("…640902+00:00").
    static func relativeUpdated(_ iso: String?) -> String {
        guard let iso, let date = parseTimestamp(iso) else { return "Last updated unknown" }
        let rel = relativeFormatter.localizedString(for: date, relativeTo: Date())
        return "Updated \(rel)"
    }

    private static func parseTimestamp(_ iso: String) -> Date? {
        if let date = isoDateTimeParser.date(from: iso) { return date }
        // Strip fractional seconds of any length, then parse without them.
        let stripped = iso.replacingOccurrences(
            of: #"\.\d+"#, with: "", options: .regularExpression
        )
        return isoDateTimeNoFracParser.date(from: stripped)
    }

    private static let isoDayParser: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static let dayMonthFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        // The payday is a calendar date (parsed at UTC midnight), so format it in
        // UTC too — otherwise a behind-UTC device shifts it back a day.
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "MMM d"
        return f
    }()

    private static let isoDateTimeParser: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoDateTimeNoFracParser: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .abbreviated
        return f
    }()
}
