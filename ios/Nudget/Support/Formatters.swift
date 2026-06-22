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

    /// "Updated 2h ago" from an ISO-8601 datetime string.
    static func relativeUpdated(_ iso: String?) -> String {
        guard let iso, let date = isoDateTimeParser.date(from: iso) else {
            return "Last updated unknown"
        }
        let rel = relativeFormatter.localizedString(for: date, relativeTo: Date())
        return "Updated \(rel)"
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
        f.dateFormat = "MMM d"
        return f
    }()

    private static let isoDateTimeParser: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .abbreviated
        return f
    }()
}
