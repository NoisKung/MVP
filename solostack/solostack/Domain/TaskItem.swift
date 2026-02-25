import Foundation

struct TaskItem: Identifiable, Hashable, Sendable {
    enum Status: String, CaseIterable, Identifiable, Sendable {
        case todo
        case inProgress
        case done

        var id: String { rawValue }

        var title: String {
            switch self {
            case .todo:
                return "To Do"
            case .inProgress:
                return "In Progress"
            case .done:
                return "Done"
            }
        }
    }

    let id: UUID
    var title: String
    var projectName: String?
    var dueDate: Date?
    var status: Status
    var updatedAt: Date
    var isImportant: Bool

    init(
        id: UUID = UUID(),
        title: String,
        projectName: String? = nil,
        dueDate: Date? = nil,
        status: Status = .todo,
        updatedAt: Date = Date(),
        isImportant: Bool = false
    ) {
        self.id = id
        self.title = title
        self.projectName = projectName
        self.dueDate = dueDate
        self.status = status
        self.updatedAt = updatedAt
        self.isImportant = isImportant
    }
}

extension TaskItem {
    static func seedData(now: Date = Date(), calendar: Calendar = .current) -> [TaskItem] {
        let today = calendar.startOfDay(for: now)
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: today)
        let inThreeDays = calendar.date(byAdding: .day, value: 3, to: today)

        return [
            TaskItem(
                title: "Finalize P3-2A architecture",
                projectName: "SoloStack iOS",
                dueDate: today,
                status: .inProgress,
                isImportant: true
            ),
            TaskItem(
                title: "Write sync fixture contract tests",
                projectName: "Sync",
                dueDate: tomorrow,
                status: .todo
            ),
            TaskItem(
                title: "Review conflict status surface",
                projectName: "UX",
                dueDate: inThreeDays,
                status: .todo
            ),
            TaskItem(
                title: "Prepare TestFlight internal checklist",
                projectName: "Release",
                dueDate: nil,
                status: .done
            ),
        ]
    }
}
