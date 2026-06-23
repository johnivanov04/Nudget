import Foundation

/// Reads/writes the latest snapshot in the App Group container shared between the
/// app and the widget extension.
enum SharedStore {
    static let appGroup = "group.app.nudget.ios"
    private static let snapshotKey = "latestSnapshot"

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: appGroup)
    }

    static func save(_ snapshot: SharedSnapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        defaults?.set(data, forKey: snapshotKey)
    }

    static func load() -> SharedSnapshot? {
        guard let data = defaults?.data(forKey: snapshotKey) else { return nil }
        return try? JSONDecoder().decode(SharedSnapshot.self, from: data)
    }

    static func clear() {
        defaults?.removeObject(forKey: snapshotKey)
    }
}
