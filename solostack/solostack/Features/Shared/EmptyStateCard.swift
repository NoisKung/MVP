import SwiftUI

struct EmptyStateCard: View {
    let title: String
    let message: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.title2.weight(.semibold))
                .foregroundStyle(DesktopTheme.accent)
                .frame(width: 40, height: 40)
                .background(DesktopTheme.accentSubtle, in: RoundedRectangle(cornerRadius: 12))

            Text(title)
                .font(.headline)
                .foregroundStyle(DesktopTheme.textPrimary)

            Text(message)
                .font(.subheadline)
                .foregroundStyle(DesktopTheme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 28)
        .frame(maxWidth: .infinity)
        .desktopCard(cornerRadius: 16, fill: DesktopTheme.bgSurface, border: DesktopTheme.borderDefault)
    }
}
