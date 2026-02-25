import SwiftUI

struct QuickCaptureBar: View {
    @Binding var text: String
    let onSubmit: () -> Void

    @Environment(\.appLayoutMetrics) private var layout

    private var canSubmit: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        HStack(spacing: layout.isRegularWidth ? 14 : 12) {
            HStack(spacing: 8) {
                Image(systemName: "plus")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(DesktopTheme.accent)
                    .frame(width: 24, height: 24)
                    .background(DesktopTheme.accentSubtle, in: RoundedRectangle(cornerRadius: 7))

                TextField(
                    "",
                    text: $text,
                    prompt: Text("Quick Capture (#project @today !)")
                        .foregroundStyle(DesktopTheme.textMuted),
                    axis: .vertical
                )
                .textFieldStyle(.plain)
                .submitLabel(.done)
                .lineLimit(1...(layout.isRegularWidth ? 3 : 2))
                .onSubmit(onSubmit)
                .foregroundStyle(DesktopTheme.textPrimary)
                .tint(DesktopTheme.accent)
            }
            .padding(.horizontal, layout.isRegularWidth ? 14 : 12)
            .padding(.vertical, layout.isRegularWidth ? 12 : 10)
            .desktopCard(
                cornerRadius: 12,
                fill: DesktopTheme.bgElevated,
                border: DesktopTheme.borderStrong
            )

            Button {
                onSubmit()
            } label: {
                Image(systemName: "arrow.up")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(DesktopTheme.textPrimary)
                    .frame(width: layout.isRegularWidth ? 42 : 38, height: layout.isRegularWidth ? 42 : 38)
                    .background(
                        canSubmit ? DesktopTheme.accent : DesktopTheme.bgMuted,
                        in: Circle()
                    )
                    .overlay {
                        Circle()
                            .stroke(
                                canSubmit ? DesktopTheme.accentHover : DesktopTheme.borderDefault,
                                lineWidth: 1
                            )
                    }
                    .shadow(
                        color: canSubmit ? DesktopTheme.accentGlow : .clear,
                        radius: 12,
                        x: 0,
                        y: 0
                    )
            }
            .buttonStyle(.plain)
            .disabled(!canSubmit)
            .accessibilityLabel("Add Task")
        }
        .padding(layout.isRegularWidth ? 14 : 12)
        .desktopCard(
            cornerRadius: 16,
            fill: DesktopTheme.bgSurface.opacity(0.96),
            border: DesktopTheme.borderDefault
        )
        .shadow(color: Color.black.opacity(0.28), radius: 16, x: 0, y: 10)
        .controlSize(.regular)
    }
}
