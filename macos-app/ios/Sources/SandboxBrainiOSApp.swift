import SandboxBrainKit
import SwiftUI

// The nav enum lives in the kit; this module-level alias keeps unqualified
// `Section` resolving to ours instead of SwiftUI.Section (same trick as the
// Mac app's RootView.swift).
typealias Section = SandboxBrainKit.Section

@main
struct SandboxBrainiOSApp: App {
    @State private var state = AppState()

    var body: some Scene {
        WindowGroup {
            ZStack {
                switch state.phase {
                case .onboarding, .signedOut, .checkingAccess, .denied:
                    OnboardingView()
                case .ready:
                    RootView()
                }

                if state.showLaunchOverlay {
                    LaunchOverlay()
                        .transition(.opacity.combined(with: .scale(scale: 1.02)))
                }
            }
            .animation(.easeOut(duration: 0.45), value: state.showLaunchOverlay)
            .environment(state)
            // Belt-and-braces: ASWebAuthenticationSession consumes the OAuth
            // callback itself; if the browser-fallback path ever lands here,
            // supabase-swift picks the session out of the URL.
            .onOpenURL { url in
                guard url.scheme == "sandboxbrain" else { return }
                // The kit's LiveBackend session handling reacts to the auth
                // sheet; nothing further to do for the sheet path.
            }
            .task { await DemoDriver.run(state: state) }
            .alert("Something went wrong", isPresented: Binding(
                get: { state.lastError != nil },
                set: { if !$0 { state.lastError = nil } }
            )) {
                Button("OK") { state.lastError = nil }
            } message: {
                Text(state.lastError ?? "")
            }
        }
    }
}

// Dev/verification helper (mirrors the Mac app's SnapshotMode): environment
// variables drive the app into demo mode for simulator screenshots.
//   SIMCTL_CHILD_SB_DEMO=1          — skip onboarding into demo mode
//   SIMCTL_CHILD_SB_SECTION=Time    — force a starting section
//   SIMCTL_CHILD_SB_START_TIMER=1   — start a timer on the first active project
enum DemoDriver {
    @MainActor
    static func run(state: AppState) async {
        let env = ProcessInfo.processInfo.environment
        guard env["SB_DEMO"] == "1" else { return }
        state.startDemo()
        await state.refresh()
        if env["SB_START_TIMER"] == "1", let project = state.projects.first(where: { $0.status == .active }) {
            try? await state.backend?.startTimer(projectId: project.id, notes: nil)
            await state.refresh()
        }
        if let raw = env["SB_SECTION"], let section = Section(rawValue: raw) {
            state.forcedSection = section
        }
    }
}
