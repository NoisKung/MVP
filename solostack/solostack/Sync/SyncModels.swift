import Foundation

enum SyncStatus: String, Equatable, Sendable {
    case synced
    case syncing
    case offline
    case conflict

    var title: String {
        switch self {
        case .synced:
            return "Synced"
        case .syncing:
            return "Syncing"
        case .offline:
            return "Offline"
        case .conflict:
            return "Conflict"
        }
    }
}

enum SyncScenario: String, CaseIterable, Identifiable, Sendable {
    case healthy
    case offline
    case conflict

    var id: String { rawValue }

    var title: String {
        switch self {
        case .healthy:
            return "Healthy"
        case .offline:
            return "Offline"
        case .conflict:
            return "Conflict"
        }
    }
}

enum SyncEngineError: Error, Equatable, LocalizedError, Sendable {
    case offline
    case conflict

    var errorDescription: String? {
        switch self {
        case .offline:
            return "Device is offline. Retry when network is available."
        case .conflict:
            return "Remote changes conflict with local state."
        }
    }
}
