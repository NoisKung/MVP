import Foundation

protocol TaskRepository: Sendable {
    func fetchTasks() async -> [TaskItem]
    func saveTasks(_ tasks: [TaskItem]) async
}
