import SandboxBrainKit
import SwiftUI

// The nav enum moved into the kit (AppState.forcedSection is typed on it).
// This module-level alias keeps unqualified `Section` resolving to ours
// instead of colliding with SwiftUI.Section across all view files.
typealias Section = SandboxBrainKit.Section

struct RootView: View {
    @Environment(AppState.self) private var state
    @State private var section: Section = .home
    @State private var timerTick = Date()

    @State private var clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    // Keep team changes flowing in: poll every 30s + refresh on app focus.
    @State private var syncTimer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationSplitView {
            List(Section.allCases, selection: $section) { s in
                Label(s.rawValue, systemImage: s.symbol)
                    .tag(s)
            }
            .navigationSplitViewColumnWidth(min: 190, ideal: 210)
            .safeAreaInset(edge: .top, spacing: 0) {
                HStack(spacing: 8) {
                    Image(systemName: "brain.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(Brand.cream)
                        .frame(width: 26, height: 26)
                        .background(Brand.ink, in: .rect(cornerRadius: 7))
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Sandbox Brain")
                            .font(.system(size: 13, weight: .semibold, design: .serif))
                        if state.isDemo {
                            Text("DEMO MODE")
                                .font(.system(size: 8, weight: .bold, design: .monospaced))
                                .foregroundStyle(Brand.purple)
                        }
                    }
                    Spacer()
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                // Blurred backdrop (like Apple's sidebars) so list items
                // scrolling underneath fade out — feathered, no hard edge.
                // Extends through the title-bar strip to the traffic lights.
                .background(fadedMaterial(fadeEdge: .bottom).ignoresSafeArea(edges: .top))
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                sidebarFooter
                    .background(fadedMaterial(fadeEdge: .top))
            }
        } detail: {
            detail
                .navigationTitle("")
        }
        .onReceive(clock) { timerTick = $0 }
        .onReceive(syncTimer) { _ in Task { await state.refresh() } }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            Task { await state.refresh() }
        }
        .task { await state.refresh() }
        .onChange(of: state.forcedSection) {
            if let forced = state.forcedSection { section = forced }
        }
    }

    @ViewBuilder
    private var detail: some View {
        switch section {
        case .home: HomeView(openSection: { section = $0 })
        case .projects: ProjectsView()
        case .ideas: IdeasView()
        case .tasks: TasksView()
        case .time: TimeView()
        case .prompts: PromptsView()
        case .agents: AgentsView()
        case .notes: NotesView()
        case .brain: BrainView()
        case .graph: GraphView()
        case .academy: AcademyView()
        case .growth: GrowthView()
        case .search: SearchView()
        }
    }

    /// Material that fades out toward one edge — the soft "content dissolves
    /// under the bar" look from Apple's own sidebars.
    private func fadedMaterial(fadeEdge: VerticalEdge) -> some View {
        Rectangle()
            .fill(.ultraThinMaterial)
            .mask(
                LinearGradient(
                    stops: [
                        .init(color: .black, location: 0),
                        .init(color: .black, location: 0.65),
                        .init(color: .clear, location: 1),
                    ],
                    startPoint: fadeEdge == .bottom ? .top : .bottom,
                    endPoint: fadeEdge == .bottom ? .bottom : .top
                )
            )
            .padding(fadeEdge == .bottom ? .bottom : .top, -14)
    }

    // Running-timer chip + profile — mirrors the web app's sidebar footer.
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
                .help("Stop timer")
            }

            HStack(spacing: 8) {
                AvatarView(profile: state.profile(state.currentUserId), size: 24,
                           color: Brand.identity(state.currentUserId ?? "", profiles: state.profiles))
                Text(state.profile(state.currentUserId)?.displayName ?? "You")
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                Spacer()
                Menu {
                    Button("Refresh") { Task { await state.refresh() } }
                    if !state.isDemo, let code = state.inviteCode {
                        Button("Copy team invite code") {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(code, forType: .string)
                        }
                    }
                    Divider()
                    Button("Sign out") { state.signOut() }
                    if !state.isDemo {
                        Button("Disconnect project…", role: .destructive) { state.resetConnection() }
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 11))
                }
                .menuStyle(.borderlessButton)
                .menuIndicator(.hidden)
                .fixedSize()
            }
        }
        .padding(10)
    }
}
