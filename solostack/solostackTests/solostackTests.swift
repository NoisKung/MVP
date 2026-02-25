//
//  solostackTests.swift
//  solostackTests
//
//  Created by supakit-s on 25/2/26.
//

import Foundation
import Testing
@testable import solostack

actor TestTaskRepository: TaskRepository {
    private var tasks: [TaskItem]

    init(seed: [TaskItem]) {
        tasks = seed
    }

    func fetchTasks() async -> [TaskItem] {
        tasks
    }

    func saveTasks(_ tasks: [TaskItem]) async {
        self.tasks = tasks
    }
}

struct TestSyncEngine: SyncEngine {
    let run: @Sendable ([TaskItem], SyncScenario) async throws -> Date

    func performSync(tasks: [TaskItem], scenario: SyncScenario) async throws -> Date {
        try await run(tasks, scenario)
    }
}

@MainActor
struct solostackTests {
    @Test func quickCaptureAddsTaskAndClearsInput() async throws {
        let repository = TestTaskRepository(seed: [])
        let syncEngine = TestSyncEngine { _, _ in Date(timeIntervalSince1970: 1234) }
        let viewModel = AppViewModel(
            environment: AppEnvironment(repository: repository, syncEngine: syncEngine)
        )

        await viewModel.loadIfNeeded()
        viewModel.quickCaptureText = "  Ship P3-2A Swift baseline  "
        await viewModel.addQuickTask()

        #expect(viewModel.tasks.count == 1)
        #expect(viewModel.tasks.first?.title == "Ship P3-2A Swift baseline")
        #expect(viewModel.quickCaptureText.isEmpty)
    }

    @Test func syncNowSetsOfflineStatusWhenEngineFails() async throws {
        let repository = TestTaskRepository(seed: TaskItem.seedData())
        let syncEngine = TestSyncEngine { _, _ in throw SyncEngineError.offline }
        let viewModel = AppViewModel(
            environment: AppEnvironment(repository: repository, syncEngine: syncEngine)
        )

        await viewModel.loadIfNeeded()
        viewModel.selectedScenario = .offline
        await viewModel.syncNow()

        #expect(viewModel.syncStatus == .offline)
        #expect(viewModel.lastSyncError == SyncEngineError.offline.errorDescription)
    }

    @Test func syncNowSetsSyncedAndTimestampOnSuccess() async throws {
        let expectedDate = Date(timeIntervalSince1970: 8_888)
        let repository = TestTaskRepository(seed: TaskItem.seedData())
        let syncEngine = TestSyncEngine { _, _ in expectedDate }
        let viewModel = AppViewModel(
            environment: AppEnvironment(repository: repository, syncEngine: syncEngine)
        )

        await viewModel.loadIfNeeded()
        viewModel.selectedScenario = .healthy
        await viewModel.syncNow()

        #expect(viewModel.syncStatus == .synced)
        #expect(viewModel.lastSyncedAt == expectedDate)
        #expect(viewModel.lastSyncError == nil)
    }

    @Test func quickCaptureParsesProjectDueDateAndImportanceTokens() async throws {
        let repository = TestTaskRepository(seed: [])
        let syncEngine = TestSyncEngine { _, _ in Date(timeIntervalSince1970: 1234) }
        let viewModel = AppViewModel(
            environment: AppEnvironment(repository: repository, syncEngine: syncEngine)
        )

        await viewModel.loadIfNeeded()
        viewModel.quickCaptureText = "Prepare QA handoff #iOS @tomorrow !"
        await viewModel.addQuickTask()

        #expect(viewModel.tasks.count == 1)
        let task = viewModel.tasks[0]
        #expect(task.title == "Prepare QA handoff")
        #expect(task.projectName == "iOS")
        #expect(task.isImportant)

        let tomorrow = Calendar.current.date(
            byAdding: .day,
            value: 1,
            to: Calendar.current.startOfDay(for: Date())
        )
        #expect(tomorrow != nil)
        #expect(task.dueDate != nil)
        if let dueDate = task.dueDate, let tomorrow {
            #expect(Calendar.current.isDate(dueDate, inSameDayAs: tomorrow))
        }
    }

    @Test func deleteTaskRemovesTaskFromCurrentState() async throws {
        let seed = TaskItem.seedData()
        let repository = TestTaskRepository(seed: seed)
        let syncEngine = TestSyncEngine { _, _ in Date(timeIntervalSince1970: 1234) }
        let viewModel = AppViewModel(
            environment: AppEnvironment(repository: repository, syncEngine: syncEngine)
        )

        await viewModel.loadIfNeeded()
        let deleteID = viewModel.tasks[0].id
        await viewModel.deleteTask(taskID: deleteID)

        #expect(viewModel.tasks.count == seed.count - 1)
        #expect(viewModel.tasks.contains(where: { $0.id == deleteID }) == false)
    }
}
