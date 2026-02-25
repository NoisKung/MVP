import SwiftUI

struct UpcomingView: View {
    let tasks: [TaskItem]
    let onToggle: (UUID) -> Void
    let onMove: (UUID, TaskItem.Status) -> Void

    var body: some View {
        List {
            if tasks.isEmpty {
                EmptyStateCard(
                    title: "No upcoming tasks",
                    message: "You're clear for upcoming due dates.",
                    systemImage: "calendar.badge.checkmark"
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
                            Button("To Do") {
                                onMove(task.id, .todo)
                            }
                            .tint(DesktopTheme.statusTodo)
                        }
                    }
                } header: {
                    Text("Upcoming")
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
