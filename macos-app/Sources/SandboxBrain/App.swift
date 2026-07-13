import SwiftUI

@main
struct SandboxBrainApp: App {
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
            // Floor is set by the widest edit sheet (~520pt) and the Notes
            // split view — below this, those stop fitting.
            .frame(minWidth: 600, minHeight: 440)
            .task {
                if SnapshotMode.directory != nil {
                    await SnapshotMode.run(state: state)
                }
            }
            .alert("Something went wrong", isPresented: Binding(
                get: { state.lastError != nil },
                set: { if !$0 { state.lastError = nil } }
            )) {
                Button("OK") { state.lastError = nil }
            } message: {
                Text(state.lastError ?? "")
            }
        }
        .windowStyle(.hiddenTitleBar)
    }
}
