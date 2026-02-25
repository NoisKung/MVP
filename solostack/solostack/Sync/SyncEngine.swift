import Foundation

protocol SyncEngine: Sendable {
    func performSync(tasks: [TaskItem], scenario: SyncScenario) async throws -> Date
}

actor DemoSyncEngine: SyncEngine {
    private let simulatedLatencyNanoseconds: UInt64

    init(simulatedLatencyNanoseconds: UInt64 = 250_000_000) {
        self.simulatedLatencyNanoseconds = simulatedLatencyNanoseconds
    }

    func performSync(tasks: [TaskItem], scenario: SyncScenario) async throws -> Date {
        _ = tasks.count

        if simulatedLatencyNanoseconds > 0 {
            try await Task.sleep(nanoseconds: simulatedLatencyNanoseconds)
        }

        switch scenario {
        case .healthy:
            return Date()
        case .offline:
            throw SyncEngineError.offline
        case .conflict:
            throw SyncEngineError.conflict
        }
    }
}
