import Combine
import Foundation

@MainActor
final class AppViewModel: ObservableObject {
    @Published private(set) var tasks: [TaskItem] = []
    @Published var quickCaptureText: String = ""
    @Published var selectedScenario: SyncScenario = .healthy
    @Published private(set) var syncStatus: SyncStatus = .synced
    @Published private(set) var lastSyncedAt: Date?
    @Published private(set) var lastSyncError: String?

    let orderedStatuses = TaskItem.Status.allCases

    private let repository: any TaskRepository
    private let syncEngine: any SyncEngine
    private var hasLoaded = false
    private let calendar = Calendar.current

    init(environment: AppEnvironment) {
        repository = environment.repository
        syncEngine = environment.syncEngine
    }

    var todayTasks: [TaskItem] {
        let endOfToday = calendar.endOfDay(for: Date())
        return tasks.filter { task in
            guard task.status != .done else { return false }
            guard let dueDate = task.dueDate else { return true }
            return dueDate <= endOfToday
        }
    }

    var upcomingTasks: [TaskItem] {
        let endOfToday = calendar.endOfDay(for: Date())
        return tasks.filter { task in
            guard task.status != .done else { return false }
            guard let dueDate = task.dueDate else { return false }
            return dueDate > endOfToday
        }
    }

    func tasks(for status: TaskItem.Status) -> [TaskItem] {
        tasks.filter { $0.status == status }
    }

    func loadIfNeeded() async {
        guard !hasLoaded else { return }
        hasLoaded = true
        tasks = await repository.fetchTasks()
    }

    func addQuickTask() async {
        let normalized = quickCaptureText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return }

        let newTask = TaskItem(
            title: normalized,
            projectName: "Inbox",
            dueDate: nil,
            status: .todo,
            updatedAt: Date()
        )

        tasks.insert(newTask, at: 0)
        quickCaptureText = ""
        await persistTasks()
    }

    func toggleCompletion(taskID: UUID) async {
        guard let index = tasks.firstIndex(where: { $0.id == taskID }) else { return }
        tasks[index].status = tasks[index].status == .done ? .todo : .done
        tasks[index].updatedAt = Date()
        await persistTasks()
    }

    func moveTask(taskID: UUID, to status: TaskItem.Status) async {
        guard let index = tasks.firstIndex(where: { $0.id == taskID }) else { return }
        tasks[index].status = status
        tasks[index].updatedAt = Date()
        await persistTasks()
    }

    func syncNow() async {
        guard syncStatus != .syncing else { return }
        syncStatus = .syncing
        lastSyncError = nil

        do {
            let syncedAt = try await syncEngine.performSync(
                tasks: tasks,
                scenario: selectedScenario
            )
            lastSyncedAt = syncedAt
            syncStatus = .synced
        } catch let error as SyncEngineError {
            switch error {
            case .offline:
                syncStatus = .offline
            case .conflict:
                syncStatus = .conflict
            }
            lastSyncError = error.errorDescription
        } catch {
            syncStatus = .conflict
            lastSyncError = error.localizedDescription
        }
    }

    private func persistTasks() async {
        await repository.saveTasks(tasks)
    }
}

private extension Calendar {
    func endOfDay(for date: Date) -> Date {
        let start = startOfDay(for: date)
        let nextDay = self.date(byAdding: .day, value: 1, to: start) ?? start
        return nextDay.addingTimeInterval(-1)
    }
}
