import SwiftUI

struct AppLayoutMetrics: Equatable {
    let isRegularWidth: Bool
    let isWideWidth: Bool
    let contentMaxWidth: CGFloat
    let listRowHorizontalInset: CGFloat
    let sceneHorizontalPadding: CGFloat
    let syncBadgeMaxWidth: CGFloat
    let quickCaptureMaxWidth: CGFloat
    let boardColumnWidth: CGFloat
    let boardColumnSpacing: CGFloat
    let prefersBoardColumns: Bool

    static let compact = AppLayoutMetrics(
        isRegularWidth: false,
        isWideWidth: false,
        contentMaxWidth: .infinity,
        listRowHorizontalInset: 16,
        sceneHorizontalPadding: 16,
        syncBadgeMaxWidth: .infinity,
        quickCaptureMaxWidth: .infinity,
        boardColumnWidth: 300,
        boardColumnSpacing: 12,
        prefersBoardColumns: false
    )

    static func resolve(width: CGFloat, horizontalSizeClass: UserInterfaceSizeClass?) -> AppLayoutMetrics {
        let regularByClass = horizontalSizeClass == .regular

        if regularByClass && width >= 1000 {
            return AppLayoutMetrics(
                isRegularWidth: true,
                isWideWidth: true,
                contentMaxWidth: 1024,
                listRowHorizontalInset: 20,
                sceneHorizontalPadding: 24,
                syncBadgeMaxWidth: 980,
                quickCaptureMaxWidth: 960,
                boardColumnWidth: 320,
                boardColumnSpacing: 16,
                prefersBoardColumns: true
            )
        }

        if regularByClass || width >= 820 {
            return AppLayoutMetrics(
                isRegularWidth: true,
                isWideWidth: false,
                contentMaxWidth: 900,
                listRowHorizontalInset: 18,
                sceneHorizontalPadding: 20,
                syncBadgeMaxWidth: 860,
                quickCaptureMaxWidth: 840,
                boardColumnWidth: 300,
                boardColumnSpacing: 14,
                prefersBoardColumns: regularByClass || width >= 1050
            )
        }

        return .compact
    }
}

private struct AppLayoutMetricsKey: EnvironmentKey {
    static var defaultValue: AppLayoutMetrics = .compact
}

extension EnvironmentValues {
    var appLayoutMetrics: AppLayoutMetrics {
        get { self[AppLayoutMetricsKey.self] }
        set { self[AppLayoutMetricsKey.self] = newValue }
    }
}
