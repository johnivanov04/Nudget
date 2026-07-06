import Foundation

/// The caller's current pay schedule from `GET /api/onboarding/paycheck`.
struct PaydaySchedule: Decodable {
    let frequency: String
    let lastPaycheckDate: String?
    let nextPaycheckDate: String?
    let weekendRule: String?
}

struct PaydayScheduleResponse: Decodable {
    let schedule: PaydaySchedule?
}
