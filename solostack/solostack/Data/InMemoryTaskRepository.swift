import Foundation

actor InMemoryTaskRepository: TaskRepository {
    private var tasks: [TaskItem]

    init(seed: [TaskItem]) {
        tasks = seed
    }

    func fetchTasks() async -> [TaskItem] {
        tasks.sorted { lhs, rhs in
            switch (lhs.dueDate, rhs.dueDate) {
            case let (lDue?, rDue?):
                if lDue == rDue {
                    return lhs.updatedAt > rhs.updatedAt
                }
                return lDue < rDue
            case (nil, nil):
                return lhs.updatedAt > rhs.updatedAt
            case (.some, nil):
                return true
            case (nil, .some):
                return false
            }
        }
    }

    func saveTasks(_ tasks: [TaskItem]) async {
        self.tasks = tasks
    }
}
