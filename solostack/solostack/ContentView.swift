//
//  ContentView.swift
//  solostack
//
//  Created by supakit-s on 25/2/26.
//

import SwiftUI

@MainActor
struct ContentView: View {
    @StateObject private var viewModel: AppViewModel
    @State private var selectedTab: Tab = .today
    @State private var searchText: String = ""
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    init(viewModel: AppViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    init() {
        _viewModel = StateObject(
            wrappedValue: AppViewModel(environment: .live())
        )
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            sceneContainer(
                title: "Today",
                tab: .today,
                systemImage: "sun.max.fill"
            ) {
                TodayView(
                    tasks: filteredTasks(viewModel.todayTasks),
                    onToggle: onToggle,
                    onMove: onMove,
                    onDelete: onDelete,
                    onRefresh: onRefresh
                )
            }

            sceneContainer(
                title: "Upcoming",
                tab: .upcoming,
                systemImage: "calendar"
            ) {
                UpcomingView(
                    tasks: filteredTasks(viewModel.upcomingTasks),
                    onToggle: onToggle,
                    onMove: onMove,
                    onDelete: onDelete,
                    onRefresh: onRefresh
                )
            }

            sceneContainer(
                title: "Board",
                tab: .board,
                systemImage: "square.grid.2x2.fill"
            ) {
                BoardView(
                    statuses: viewModel.orderedStatuses,
                    tasksForStatus: { status in
                        filteredTasks(viewModel.tasks(for: status))
                    },
                    onToggle: onToggle,
                    onMove: onMove,
                    onDelete: onDelete,
                    onRefresh: onRefresh
                )
            }
        }
        .task {
            await viewModel.loadIfNeeded()
        }
        .tint(DesktopTheme.accent)
        .toolbarBackground(.visible, for: .tabBar)
        .toolbarBackground(DesktopTheme.bgSurface, for: .tabBar)
        .toolbarColorScheme(.dark, for: .tabBar)
        .background(DesktopTheme.appGradient.ignoresSafeArea())
        .preferredColorScheme(.dark)
    }
}

private extension ContentView {
    enum Tab: Hashable {
        case today
        case upcoming
        case board
    }

    func onToggle(_ taskID: UUID) {
        Task { await viewModel.toggleCompletion(taskID: taskID) }
    }

    func onMove(_ taskID: UUID, _ status: TaskItem.Status) {
        Task { await viewModel.moveTask(taskID: taskID, to: status) }
    }

    func onDelete(_ taskID: UUID) {
        Task { await viewModel.deleteTask(taskID: taskID) }
    }

    func onRefresh() async {
        await viewModel.syncNow()
    }

    func filteredTasks(_ tasks: [TaskItem]) -> [TaskItem] {
        let terms = searchText
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .split(whereSeparator: \.isWhitespace)

        guard !terms.isEmpty else { return tasks }

        return tasks.filter { task in
            let searchable = [
                task.title,
                task.projectName ?? "",
                task.status.title,
                task.isImportant ? "important" : ""
            ]
                .joined(separator: " ")
                .lowercased()

            return terms.allSatisfy { searchable.contains($0) }
        }
    }

    @ViewBuilder
    func sceneContainer<Content: View>(
        title: String,
        tab: Tab,
        systemImage: String,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        NavigationStack {
            GeometryReader { proxy in
                let metrics = AppLayoutMetrics.resolve(
                    width: proxy.size.width,
                    horizontalSizeClass: horizontalSizeClass
                )

                ZStack {
                    DesktopTheme.appGradient
                        .ignoresSafeArea()

                    content()
                        .frame(maxWidth: metrics.contentMaxWidth)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                .environment(\.appLayoutMetrics, metrics)
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(metrics.isRegularWidth ? .inline : .large)
                .toolbar { syncToolbar }
                .searchable(
                    text: $searchText,
                    placement: .navigationBarDrawer(displayMode: .automatic),
                    prompt: "Search tasks or projects"
                )
                .toolbarBackground(.visible, for: .navigationBar)
                .toolbarBackground(DesktopTheme.bgSurface, for: .navigationBar)
                .toolbarColorScheme(.dark, for: .navigationBar)
                .safeAreaInset(edge: .top) {
                    SyncStatusBadge(
                        status: viewModel.syncStatus,
                        lastSyncedAt: viewModel.lastSyncedAt,
                        errorMessage: viewModel.lastSyncError
                    )
                    .frame(maxWidth: metrics.syncBadgeMaxWidth)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, metrics.sceneHorizontalPadding)
                    .padding(.top, metrics.isRegularWidth ? 6 : 4)
                }
                .safeAreaInset(edge: .bottom) {
                    QuickCaptureBar(text: $viewModel.quickCaptureText) {
                        Task { await viewModel.addQuickTask() }
                    }
                    .frame(maxWidth: metrics.quickCaptureMaxWidth)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, metrics.sceneHorizontalPadding)
                    .padding(.top, metrics.isRegularWidth ? 10 : 8)
                    .padding(.bottom, metrics.isRegularWidth ? 12 : 8)
                    .background {
                        LinearGradient(
                            colors: [
                                DesktopTheme.bgBase.opacity(0),
                                DesktopTheme.bgBase.opacity(0.92)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                        .ignoresSafeArea()
                    }
                }
            }
        }
        .tabItem {
            Label(title, systemImage: systemImage)
        }
        .tag(tab)
    }

    @ToolbarContentBuilder
    var syncToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Menu {
                ForEach(SyncScenario.allCases) { scenario in
                    Button {
                        viewModel.selectedScenario = scenario
                    } label: {
                        if scenario == viewModel.selectedScenario {
                            Label(scenario.title, systemImage: "checkmark")
                        } else {
                            Text(scenario.title)
                        }
                    }
                }
            } label: {
                Label("Scenario", systemImage: "slider.horizontal.3")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(DesktopTheme.textSecondary)
            }
        }

        ToolbarItem(placement: .topBarTrailing) {
            Button {
                Task { await viewModel.syncNow() }
            } label: {
                if viewModel.syncStatus == .syncing {
                    ProgressView()
                        .tint(DesktopTheme.accent)
                } else {
                    Label("Sync", systemImage: "arrow.clockwise")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(DesktopTheme.textPrimary)
                }
            }
            .disabled(viewModel.syncStatus == .syncing)
        }
    }
}

#if DEBUG
struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
#endif
