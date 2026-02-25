import SwiftUI

struct BoardView: View {
    let statuses: [TaskItem.Status]
    let tasksForStatus: (TaskItem.Status) -> [TaskItem]
    let onToggle: (UUID) -> Void
    let onMove: (UUID, TaskItem.Status) -> Void

    var body: some View {
        List {
            ForEach(statuses) { status in
                Section {
                    let tasks = tasksForStatus(status)
                    if tasks.isEmpty {
                        Text("No tasks")
                            .font(.caption)
                            .foregroundStyle(DesktopTheme.textMuted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .desktopCard(
                                fill: DesktopTheme.bgSurface,
                                border: DesktopTheme.borderDefault
                            )
                            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                            .listRowSeparator(.hidden)
                            .listRowBackground(Color.clear)
                    } else {
                        ForEach(tasks) { task in
                            TaskRowView(
                                task: task,
                                onToggle: { onToggle(task.id) },
                                onMove: { nextStatus in onMove(task.id, nextStatus) }
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
                        }
                    }
                } header: {
                    HStack(spacing: 8) {
                        Circle()
                            .fill(status.tint)
                            .frame(width: 7, height: 7)

                        Text(status.title)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(DesktopTheme.textMuted)
                    }
                }
                .textCase(nil)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Color.clear)
    }
}
