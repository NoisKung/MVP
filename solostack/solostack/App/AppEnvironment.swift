import Foundation

struct AppEnvironment {
    let repository: any TaskRepository
    let syncEngine: any SyncEngine

    static func live() -> AppEnvironment {
        AppEnvironment(
            repository: InMemoryTaskRepository(seed: TaskItem.seedData()),
            syncEngine: DemoSyncEngine()
        )
    }
}
