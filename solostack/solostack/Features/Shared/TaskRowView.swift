import SwiftUI

struct TaskRowView: View {
    let task: TaskItem
    let onToggle: () -> Void
    let onMove: (TaskItem.Status) -> Void

    @Environment(\.appLayoutMetrics) private var layout

    var body: some View {
        HStack(alignment: .top, spacing: layout.isRegularWidth ? 14 : 12) {
            Button(action: onToggle) {
                Image(systemName: task.status == .done ? "checkmark.circle.fill" : "circle")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(task.status == .done ? DesktopTheme.statusDone : DesktopTheme.textMuted)
            }
            .buttonStyle(.plain)
            .padding(.top, 2)

            VStack(alignment: .leading, spacing: 8) {
                Text(task.title)
                    .font(.body.weight(.medium))
                    .strikethrough(task.status == .done)
                    .foregroundStyle(task.status == .done ? DesktopTheme.textMuted : DesktopTheme.textPrimary)

                HStack(spacing: 8) {
                    if let projectName = task.projectName, !projectName.isEmpty {
                        metadataPill(
                            title: projectName,
                            systemImage: "folder.fill",
                            tint: DesktopTheme.textSecondary
                        )
                    }

                    if let dueDate = task.dueDate {
                        metadataPill(
                            title: dueDate.formatted(date: .abbreviated, time: .omitted),
                            systemImage: "calendar",
                            tint: DesktopTheme.textSecondary
                        )
                    }

                    if task.isImportant {
                        metadataPill(
                            title: "Important",
                            systemImage: "star.fill",
                            tint: DesktopTheme.warning
                        )
                    }
                }
            }

            Spacer(minLength: 8)

            Menu {
                ForEach(TaskItem.Status.allCases) { status in
                    Button {
                        onMove(status)
                    } label: {
                        if status == task.status {
                            Label(status.title, systemImage: "checkmark")
                        } else {
                            Text(status.title)
                        }
                    }
                }
            } label: {
                HStack(spacing: 6) {
                    Text(task.status.title)
                        .font(.caption.weight(.semibold))
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption2.weight(.semibold))
                }
                .foregroundStyle(task.status.tint)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(task.status.subtleTint, in: Capsule())
                .overlay {
                    Capsule()
                        .stroke(task.status.tint.opacity(0.35), lineWidth: 1)
                }
            }
            .buttonStyle(.plain)
        }
        .padding(layout.isRegularWidth ? 14 : 12)
        .desktopCard(
            fill: DesktopTheme.bgElevated,
            border: task.status.tint.opacity(0.35)
        )
        .shadow(color: Color.black.opacity(0.18), radius: 8, x: 0, y: 4)
        .contentShape(
            RoundedRectangle(cornerRadius: DesktopTheme.cardCornerRadius, style: .continuous)
        )
    }

    @ViewBuilder
    private func metadataPill(title: String, systemImage: String, tint: Color) -> some View {
        Label(title, systemImage: systemImage)
            .font(.caption2.weight(.medium))
            .foregroundStyle(tint)
            .lineLimit(1)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(DesktopTheme.bgMuted, in: Capsule())
            .overlay {
                Capsule()
                    .stroke(DesktopTheme.borderDefault, lineWidth: 1)
            }
    }
}
