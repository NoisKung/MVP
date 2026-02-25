import SwiftUI

struct TodayView: View {
    let tasks: [TaskItem]
    let onToggle: (UUID) -> Void
    let onMove: (UUID, TaskItem.Status) -> Void
    let onDelete: (UUID) -> Void
    let onRefresh: () async -> Void

    @Environment(\.appLayoutMetrics) private var layout

    var body: some View {
        List {
            if tasks.isEmpty {
                EmptyStateCard(
                    title: "No tasks for today",
                    message: "Use quick capture to add your first task.",
                    systemImage: "sun.max"
                )
                .listRowInsets(
                    EdgeInsets(
                        top: 10,
                        leading: layout.listRowHorizontalInset,
                        bottom: 10,
                        trailing: layout.listRowHorizontalInset
                    )
                )
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
                        .listRowInsets(
                            EdgeInsets(
                                top: 6,
                                leading: layout.listRowHorizontalInset,
                                bottom: 6,
                                trailing: layout.listRowHorizontalInset
                            )
                        )
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(task.status == .done ? "Undo" : "Done") {
                                onToggle(task.id)
                            }
                            .tint(task.status == .done ? DesktopTheme.bgMuted : DesktopTheme.statusDone)

                            Button(role: .destructive) {
                                onDelete(task.id)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
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
        .refreshable {
            await onRefresh()
        }
        .background(Color.clear)
        .frame(maxWidth: layout.contentMaxWidth)
        .frame(maxWidth: .infinity, alignment: .center)
    }
}
