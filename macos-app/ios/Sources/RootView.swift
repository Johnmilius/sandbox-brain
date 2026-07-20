import SandboxBrainKit
import SwiftUI

// Adaptive shell: iPhone gets a five-tab TabView (Home · Time · Tasks ·
// Search · More), iPad (regular width) gets the Mac-style NavigationSplitView
// with the full section list. Both route through the kit's Section enum.

struct RootView: View {
    @Environment(AppState.self) private var state
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.scenePhase) private var scenePhase

    /// iPad sidebar selection (all sections).
    @State private var section: Section = .home
    /// iPhone tab selection; sections outside the tab bar live under More.
    @State private var tab: PhoneTab = .home
    @State private var morePath: [Section] = []
    @State private var timerTick = Date()

    // @State so publishers survive re-renders (a `let` publisher would be
    // replaced on every parent re-render and never fire — hard-won Mac lesson).
    @State private var clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    @State private var syncTimer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    enum PhoneTab: Hashable { case home, time, tasks, search, more }

    var body: some View {
        Group {
            if horizontalSizeClass == .regular {
                splitLayout
                    // Only the iPad sidebar footer shows a ticking clock, so
                    // the 1s tick subscribes here — putting it on the shared
                    // Group would invalidate the whole iPhone TabView tree
                    // every second for nothing.
                    .onReceive(clock) { timerTick = $0 }
            } else {
                tabLayout
            }
        }
        .onReceive(syncTimer) { _ in Task { await state.refresh() } }
        .onChange(of: scenePhase) {
            if scenePhase == .active { Task { await state.refresh() } }
        }
        .task {
            await state.refresh()
            // Apply a section forced before this view mounted (snapshot/demo driver).
            if let forced = state.forcedSection { open(forced) }
        }
        .onChange(of: state.forcedSection) {
            if let forced = state.forcedSection { open(forced) }
        }
        .tint(Brand.ink)
    }

    /// Route to a section on whichever layout is active.
    private func open(_ s: Section) {
        section = s
        switch s {
        case .home: tab = .home
        case .time: tab = .time
        case .tasks: tab = .tasks
        case .search: tab = .search
        default:
            tab = .more
            morePath = [s]
        }
    }

    // MARK: iPhone — tabs

    private var tabLayout: some View {
        TabView(selection: $tab) {
            Tab("Home", systemImage: Section.home.symbol, value: PhoneTab.home) {
                NavigationStack { HomeView(openSection: { open($0) }) }
            }
            Tab("Time", systemImage: Section.time.symbol, value: PhoneTab.time) {
                NavigationStack { TimeView() }
            }
            Tab("Tasks", systemImage: Section.tasks.symbol, value: PhoneTab.tasks) {
                NavigationStack { TasksView() }
            }
            Tab(value: PhoneTab.search, role: .search) {
                NavigationStack { SearchView() }
            }
            Tab("More", systemImage: "ellipsis", value: PhoneTab.more) {
                NavigationStack(path: $morePath) {
                    MoreView()
                        .navigationDestination(for: Section.self) { moreDetail(for: $0) }
                }
            }
        }
    }

    // MARK: iPad — split view

    private var splitLayout: some View {
        NavigationSplitView {
            List(Section.allCases, selection: Binding(get: { section as Section? },
                                                      set: { open($0 ?? .home) })) { s in
                Label(s.rawValue, systemImage: s.symbol)
                    .tag(s)
            }
            .navigationTitle("Sandbox Brain")
            .safeAreaInset(edge: .bottom, spacing: 0) { sidebarFooter }
        } detail: {
            NavigationStack { detail(for: section) }
        }
    }

    @ViewBuilder
    private func detail(for section: Section) -> some View {
        switch section {
        case .home: HomeView(openSection: { open($0) })
        case .projects: ProjectsView()
        case .tasks: TasksView()
        case .time: TimeView()
        case .search: SearchView()
        case .ideas: IdeasView()
        case .prompts: PromptsView()
        case .agents: AgentsView()
        case .notes: NotesView()
        case .brain: BrainView()
        case .graph: GraphView()
        case .academy: AcademyView()
        case .growth: GrowthView()
        }
    }

    /// Destinations reachable from the More list (never the tab sections).
    @ViewBuilder
    private func moreDetail(for section: Section) -> some View {
        switch section {
        case .projects: ProjectsView()
        default: detail(for: section)
        }
    }

    // Running-timer chip + profile (iPad sidebar; mirrors the Mac footer).
    private var sidebarFooter: some View {
        VStack(spacing: 8) {
            if let running = state.myRunningEntry {
                Button {
                    state.perform { [id = running.id, backend = state.backend] in
                        try await backend?.stopTimer(entryId: id)
                    }
                } label: {
                    HStack(spacing: 6) {
                        Circle().fill(Brand.green).frame(width: 6, height: 6)
                        Text(state.project(running.projectId)?.name ?? "Timer")
                            .font(.system(size: 11, weight: .medium))
                            .lineLimit(1)
                        Spacer()
                        Text(formatClock(ms: running.durationMs(now: timerTick)))
                            .font(.system(size: 11, design: .monospaced))
                        Image(systemName: "stop.fill")
                            .font(.system(size: 8))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                }
                .buttonStyle(.plain)
                .glassEffect(.regular.tint(Brand.green.opacity(0.1)), in: .capsule)
            }

            HStack(spacing: 8) {
                AvatarView(profile: state.profile(state.currentUserId), size: 24,
                           color: Brand.identity(state.currentUserId ?? "", profiles: state.profiles))
                Text(state.profile(state.currentUserId)?.displayName ?? "You")
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                if state.isDemo {
                    Text("DEMO")
                        .font(.system(size: 8, weight: .bold, design: .monospaced))
                        .foregroundStyle(Brand.purple)
                }
                Spacer()
                Menu {
                    Button("Refresh") { Task { await state.refresh() } }
                    if !state.isDemo, let code = state.inviteCode {
                        Button("Copy team invite code") {
                            UIPasteboard.general.string = code
                        }
                    }
                    Divider()
                    Button("Sign out") { state.signOut() }
                    if !state.isDemo {
                        Button("Disconnect project…", role: .destructive) { state.resetConnection() }
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 12))
                        .foregroundStyle(Brand.mutedText)
                        .frame(width: 28, height: 28)
                        .contentShape(.rect)
                }
            }
        }
        .padding(10)
        .background(.ultraThinMaterial)
    }
}
