import Foundation

/// Tiny helper to read a JWT's expiry without a library. We only need `exp` to
/// decide whether to refresh proactively — no signature verification (the server
/// does that; a forged token just fails the API call).
enum JWT {
    /// The token's expiry, or nil if it can't be parsed.
    static func expiry(_ token: String) -> Date? {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return nil }
        guard let payload = base64urlDecode(String(parts[1])),
              let json = try? JSONSerialization.jsonObject(with: payload) as? [String: Any],
              let exp = json["exp"] as? Double
        else { return nil }
        return Date(timeIntervalSince1970: exp)
    }

    /// True if the token is missing/expired or expires within `leeway` seconds.
    static func isExpired(_ token: String, leeway: TimeInterval = 120) -> Bool {
        guard let exp = expiry(token) else { return true }
        return exp.timeIntervalSinceNow <= leeway
    }

    /// The token's `sub` claim (the user id), or nil.
    static func subject(_ token: String) -> String? {
        let parts = token.split(separator: ".")
        guard parts.count == 3,
              let payload = base64urlDecode(String(parts[1])),
              let json = try? JSONSerialization.jsonObject(with: payload) as? [String: Any]
        else { return nil }
        return json["sub"] as? String
    }

    private static func base64urlDecode(_ s: String) -> Data? {
        var b64 = s.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while b64.count % 4 != 0 { b64.append("=") }
        return Data(base64Encoded: b64)
    }
}
