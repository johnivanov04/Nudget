import Foundation
import CryptoKit

/// Nonce helpers for Sign in with Apple. Flow: generate a random nonce, send its
/// SHA-256 hash to Apple in the auth request; Apple embeds the hash in the
/// identity token. We then send the RAW nonce to Supabase, which re-hashes and
/// compares — preventing replay of a stolen identity token.
enum AppleNonce {
    /// A cryptographically-random URL-safe nonce string.
    static func random(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length
        while remaining > 0 {
            var bytes = [UInt8](repeating: 0, count: 16)
            _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
            for byte in bytes where remaining > 0 {
                result.append(charset[Int(byte) % charset.count])
                remaining -= 1
            }
        }
        return result
    }

    /// SHA-256 of the nonce, hex-encoded — what Apple's request expects.
    static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }
}
