import SwiftUI

struct SyncStatusBadge: View {
    let status: SyncStatus
    let lastSyncedAt: Date?
    let errorMessage: String?

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: status.symbolName)
                .font(.headline.weight(.semibold))
                .foregroundStyle(status.tint)
                .frame(width: 28, height: 28)
                .background(status.tint.opacity(0.14), in: RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 4) {
                Text(status.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(DesktopTheme.textPrimary)

                if let lastSyncedAt {
                    Text("Last sync \(lastSyncedAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(.caption)
                        .foregroundStyle(DesktopTheme.textSecondary)
                } else {
                    Text("Last sync never")
                        .font(.caption)
                        .foregroundStyle(DesktopTheme.textSecondary)
                }

                if let errorMessage, !errorMessage.isEmpty {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(DesktopTheme.danger)
                        .lineLimit(2)
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .desktopCard(
            cornerRadius: 14,
            fill: DesktopTheme.bgSurface.opacity(0.94),
            border: status.tint.opacity(0.4)
        )
        .overlay(alignment: .trailing) {
            RoundedRectangle(cornerRadius: 999, style: .continuous)
                .fill(status.tint.opacity(0.18))
                .frame(width: 6)
                .padding(.vertical, 10)
                .padding(.trailing, 10)
        }
    }
}

private extension SyncStatus {
    var symbolName: String {
        switch self {
        case .synced:
            return "checkmark.circle.fill"
        case .syncing:
            return "arrow.triangle.2.circlepath.circle.fill"
        case .offline:
            return "wifi.slash"
        case .conflict:
            return "exclamationmark.triangle.fill"
        }
    }
}
