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
        guard let capture = parseQuickCaptureInput(quickCaptureText) else { return }

        let newTask = TaskItem(
            title: capture.title,
            projectName: capture.projectName,
            dueDate: capture.dueDate,
            status: .todo,
            updatedAt: Date(),
            isImportant: capture.isImportant
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

    func deleteTask(taskID: UUID) async {
        guard let index = tasks.firstIndex(where: { $0.id == taskID }) else { return }
        tasks.remove(at: index)
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

    private func parseQuickCaptureInput(_ input: String) -> QuickCaptureInput? {
        let normalized = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return nil }

        let tokens = normalized.split(whereSeparator: \.isWhitespace).map(String.init)
        var titleTokens: [String] = []
        var projectName: String?
        var dueDate: Date?
        var isImportant = false

        for token in tokens {
            let lowered = token.lowercased()

            if lowered == "!" {
                isImportant = true
                continue
            }

            if lowered.hasPrefix("!") {
                isImportant = true
                let stripped = String(token.dropFirst())
                if !stripped.isEmpty {
                    titleTokens.append(stripped)
                }
                continue
            }

            if lowered.hasPrefix("#"), token.count > 1, projectName == nil {
                let candidate = String(token.dropFirst())
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                if !candidate.isEmpty {
                    projectName = candidate
                    continue
                }
            }

            switch lowered {
            case "@today":
                dueDate = calendar.startOfDay(for: Date())
                continue
            case "@tomorrow":
                let today = calendar.startOfDay(for: Date())
                dueDate = calendar.date(byAdding: .day, value: 1, to: today)
                continue
            case "@nextweek":
                let today = calendar.startOfDay(for: Date())
                dueDate = calendar.date(byAdding: .day, value: 7, to: today)
                continue
            default:
                break
            }

            titleTokens.append(token)
        }

        let title = titleTokens
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return nil }

        return QuickCaptureInput(
            title: title,
            projectName: projectName ?? "Inbox",
            dueDate: dueDate,
            isImportant: isImportant
        )
    }
}

private struct QuickCaptureInput {
    let title: String
    let projectName: String
    let dueDate: Date?
    let isImportant: Bool
}

private extension Calendar {
    func endOfDay(for date: Date) -> Date {
        let start = startOfDay(for: date)
        let nextDay = self.date(byAdding: .day, value: 1, to: start) ?? start
        return nextDay.addingTimeInterval(-1)
    }
}
