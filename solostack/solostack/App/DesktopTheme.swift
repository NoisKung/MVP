import SwiftUI

enum DesktopTheme {
    static let bgBase = Color.srgb(9, 9, 11)
    static let bgSurface = Color.srgb(17, 17, 19)
    static let bgElevated = Color.srgb(24, 24, 27)
    static let bgMuted = Color.srgb(30, 30, 34)

    static let borderDefault = Color.white.opacity(0.06)
    static let borderStrong = Color.white.opacity(0.10)

    static let textPrimary = Color.srgb(250, 250, 250)
    static let textSecondary = Color.srgb(161, 161, 170)
    static let textMuted = Color.srgb(113, 113, 122)

    static let accent = Color.srgb(124, 105, 255)
    static let accentHover = Color.srgb(139, 123, 255)
    static let accentSubtle = Color.srgb(124, 105, 255, alpha: 0.12)
    static let accentGlow = Color.srgb(124, 105, 255, alpha: 0.18)

    static let success = Color.srgb(52, 211, 153)
    static let warning = Color.srgb(251, 191, 36)
    static let danger = Color.srgb(248, 113, 113)
    static let info = Color.srgb(96, 165, 250)

    static let statusTodo = Color.srgb(96, 165, 250)
    static let statusDoing = Color.srgb(251, 191, 36)
    static let statusDone = Color.srgb(52, 211, 153)

    static let appGradient = LinearGradient(
        colors: [bgBase, bgSurface],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let panelGradient = LinearGradient(
        colors: [bgSurface, bgElevated],
        startPoint: .top,
        endPoint: .bottom
    )

    static let cardCornerRadius: CGFloat = 12
}

private extension Color {
    static func srgb(_ red: Double, _ green: Double, _ blue: Double, alpha: Double = 1) -> Color {
        Color(.sRGB, red: red / 255, green: green / 255, blue: blue / 255, opacity: alpha)
    }
}

extension TaskItem.Status {
    var tint: Color {
        switch self {
        case .todo:
            return DesktopTheme.statusTodo
        case .inProgress:
            return DesktopTheme.statusDoing
        case .done:
            return DesktopTheme.statusDone
        }
    }

    var subtleTint: Color {
        tint.opacity(0.14)
    }
}

extension SyncStatus {
    var tint: Color {
        switch self {
        case .synced:
            return DesktopTheme.success
        case .syncing:
            return DesktopTheme.info
        case .offline:
            return DesktopTheme.warning
        case .conflict:
            return DesktopTheme.danger
        }
    }
}

extension View {
    func desktopCard(
        cornerRadius: CGFloat = DesktopTheme.cardCornerRadius,
        fill: Color = DesktopTheme.bgElevated,
        border: Color = DesktopTheme.borderDefault
    ) -> some View {
        background(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(fill)
        )
        .overlay(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .stroke(border, lineWidth: 1)
        )
    }
}
