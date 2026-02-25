import SwiftUI

struct BoardView: View {
    let statuses: [TaskItem.Status]
    let tasksForStatus: (TaskItem.Status) -> [TaskItem]
    let onToggle: (UUID) -> Void
    let onMove: (UUID, TaskItem.Status) -> Void
    let onDelete: (UUID) -> Void
    let onRefresh: () async -> Void

    @Environment(\.appLayoutMetrics) private var layout

    var body: some View {
        Group {
            if layout.prefersBoardColumns {
                boardColumnsLayout
            } else {
                boardListLayout
            }
        }
        .background(Color.clear)
    }

    private var boardColumnsLayout: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(alignment: .top, spacing: layout.boardColumnSpacing) {
                ForEach(statuses) { status in
                    boardColumn(status: status)
                        .frame(width: layout.boardColumnWidth, alignment: .top)
                }
            }
            .padding(.horizontal, layout.listRowHorizontalInset)
            .padding(.vertical, 10)
        }
        .refreshable {
            await onRefresh()
        }
        .frame(maxWidth: layout.contentMaxWidth)
        .frame(maxWidth: .infinity, alignment: .center)
    }

    private var boardListLayout: some View {
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
                    } else {
                        ForEach(tasks) { task in
                            TaskRowView(
                                task: task,
                                onToggle: { onToggle(task.id) },
                                onMove: { nextStatus in onMove(task.id, nextStatus) }
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
        .refreshable {
            await onRefresh()
        }
        .frame(maxWidth: layout.contentMaxWidth)
        .frame(maxWidth: .infinity, alignment: .center)
    }

    @ViewBuilder
    private func boardColumn(status: TaskItem.Status) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Circle()
                    .fill(status.tint)
                    .frame(width: 8, height: 8)

                Text(status.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(DesktopTheme.textSecondary)
            }

            let tasks = tasksForStatus(status)
            if tasks.isEmpty {
                Text("No tasks")
                    .font(.caption)
                    .foregroundStyle(DesktopTheme.textMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .desktopCard(fill: DesktopTheme.bgMuted, border: DesktopTheme.borderDefault)
            } else {
                ForEach(tasks) { task in
                    TaskRowView(
                        task: task,
                        onToggle: { onToggle(task.id) },
                        onMove: { nextStatus in onMove(task.id, nextStatus) }
                    )
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
                }
            }
        }
        .padding(12)
        .desktopCard(cornerRadius: 16, fill: DesktopTheme.bgSurface, border: DesktopTheme.borderDefault)
    }
}
