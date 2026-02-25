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
                    tasks: viewModel.todayTasks,
                    onToggle: onToggle,
                    onMove: onMove
                )
            }

            sceneContainer(
                title: "Upcoming",
                tab: .upcoming,
                systemImage: "calendar"
            ) {
                UpcomingView(
                    tasks: viewModel.upcomingTasks,
                    onToggle: onToggle,
                    onMove: onMove
                )
            }

            sceneContainer(
                title: "Board",
                tab: .board,
                systemImage: "square.grid.2x2.fill"
            ) {
                BoardView(
                    statuses: viewModel.orderedStatuses,
                    tasksForStatus: { status in viewModel.tasks(for: status) },
                    onToggle: onToggle,
                    onMove: onMove
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

    @ViewBuilder
    func sceneContainer<Content: View>(
        title: String,
        tab: Tab,
        systemImage: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        NavigationStack {
            ZStack {
                DesktopTheme.appGradient
                    .ignoresSafeArea()

                content()
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.large)
            .toolbar { syncToolbar }
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(DesktopTheme.bgSurface, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .safeAreaInset(edge: .top) {
                SyncStatusBadge(
                    status: viewModel.syncStatus,
                    lastSyncedAt: viewModel.lastSyncedAt,
                    errorMessage: viewModel.lastSyncError
                )
                .padding(.horizontal, 16)
                .padding(.top, 4)
            }
            .safeAreaInset(edge: .bottom) {
                QuickCaptureBar(text: $viewModel.quickCaptureText) {
                    Task { await viewModel.addQuickTask() }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 8)
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
