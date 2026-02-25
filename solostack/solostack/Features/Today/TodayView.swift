import SwiftUI

struct TodayView: View {
    let tasks: [TaskItem]
    let onToggle: (UUID) -> Void
    let onMove: (UUID, TaskItem.Status) -> Void

    var body: some View {
        List {
            if tasks.isEmpty {
                EmptyStateCard(
                    title: "No tasks for today",
                    message: "Use quick capture to add your first task.",
                    systemImage: "sun.max"
                )
                .listRowInsets(EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16))
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)
            } else {
                Section {
                    ForEach(tasks) { task in
                        TaskRowView(
                            task: task,
                            onToggle: { onToggle(task.id) },
                            onMove: { status in onMove(task.id, status) }
                        )
                        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(task.status == .done ? "Undo" : "Done") {
                                onToggle(task.id)
                            }
                            .tint(task.status == .done ? DesktopTheme.bgMuted : DesktopTheme.statusDone)
                        }
                        .swipeActions(edge: .leading, allowsFullSwipe: false) {
                            Button("In Progress") {
                                onMove(task.id, .inProgress)
                            }
                            .tint(DesktopTheme.statusDoing)
                        }
                    }
                } header: {
                    Text("Due Today")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(DesktopTheme.textMuted)
                }
                .textCase(nil)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Color.clear)
    }
}
