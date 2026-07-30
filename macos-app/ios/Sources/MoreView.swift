import SandboxBrainKit
import SwiftUI

// More — everything that doesn't fit in the phone tab bar. Account actions
// live in the footer (mirrors the Mac sidebar footer menu).

struct MoreView: View {
    @Environment(AppState.self) private var state

    private let sections: [Section] = [
        .projects, .ideas, .prompts, .agents, .notes, .brain, .graph, .academy, .growth,
    ]

    var body: some View {
        List {
            SwiftUI.Section {
                ForEach(sections) { s in
                    NavigationLink(value: s) {
                        Label {
                            Text(s.rawValue)
                        } icon: {
                            Image(systemName: s.symbol)
                                .foregroundStyle(Brand.ink)
                        }
                    }
                }
            }

            SwiftUI.Section("Account") {
                HStack(spacing: 10) {
                    AvatarView(profile: state.profile(state.currentUserId), size: 32,
                               color: Brand.identity(state.currentUserId ?? "", profiles: state.profiles))
                    VStack(alignment: .leading, spacing: 1) {
                        Text(state.profile(state.currentUserId)?.displayName ?? "You")
                            .font(.system(size: 14, weight: .medium))
                        if state.isDemo {
                            Text("DEMO MODE")
                                .font(.system(size: 8, weight: .bold, design: .monospaced))
                                .foregroundStyle(Brand.purple)
                        } else if let email = state.profile(state.currentUserId)?.email {
                            Text(email)
                                .font(.system(size: 11))
                                .foregroundStyle(Brand.mutedText)
                        }
                    }
                }
                Button("Refresh") { Task { await state.refresh() } }
                if !state.isDemo, let code = state.inviteCode {
                    Button("Copy team invite code") {
                        UIPasteboard.general.string = code
                    }
                }
                Button("Sign out", role: .destructive) { state.signOut() }
                if !state.isDemo {
                    Button("Disconnect project…", role: .destructive) { state.resetConnection() }
                }
            }
        }
        .navigationTitle("More")
        .scrollContentBackground(.hidden)
        .background(Brand.cream)
    }
}
