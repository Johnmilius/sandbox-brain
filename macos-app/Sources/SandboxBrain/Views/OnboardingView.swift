import SwiftUI

// First-run flow, written for the least technical teammate: paste one invite
// code, sign in with Google, done. Manual URL/key entry hides under Advanced.
// Credentials land in the macOS Keychain — never on disk, never in the repo.

struct OnboardingView: View {
    @Environment(AppState.self) private var state

    @State private var inviteCode = ""
    @State private var showAdvanced = false
    @State private var urlString = ""
    @State private var anonKey = ""

    var body: some View {
        ZStack {
            Brand.cream.ignoresSafeArea()

            VStack(spacing: 26) {
                header

                Group {
                    switch state.phase {
                    case .onboarding: connectCard
                    case .signedOut: signInCard
                    case .checkingAccess: checkingCard
                    case .denied(let email): deniedCard(email: email)
                    case .ready: EmptyView()
                    }
                }
                .frame(width: 460)

                if state.phase == .onboarding || state.phase == .signedOut {
                    Button {
                        state.startDemo()
                    } label: {
                        Text("Just looking around? ")
                            .foregroundStyle(Brand.mutedText)
                        + Text("Try the demo")
                            .foregroundStyle(Brand.purple)
                            .fontWeight(.medium)
                    }
                    .buttonStyle(.plain)
                    .font(.system(size: 13))
                }
            }
            .animation(.snappy, value: state.phase)
        }
    }

    private var header: some View {
        VStack(spacing: 10) {
            Image(systemName: "brain.fill")
                .font(.system(size: 36))
                .foregroundStyle(Brand.cream)
                .frame(width: 76, height: 76)
                .background(Brand.ink, in: .rect(cornerRadius: 19))
                .shadow(color: .black.opacity(0.18), radius: 14, y: 6)
            Text("Sandbox Brain")
                .font(.system(size: 32, weight: .medium, design: .serif))
                .foregroundStyle(Brand.ink)
            Text("Your team's shared memory — time, tasks, notes, and ideas in one place.")
                .font(.system(size: 13))
                .foregroundStyle(Brand.mutedText)
        }
    }

    private func stepLabel(_ text: String) -> some View {
        HStack(spacing: 8) {
            MonoLabel(text: text)
            Rectangle().fill(Brand.border).frame(height: 1)
        }
    }

    // MARK: Step 1 — join with an invite code

    private var connectCard: some View {
        GlassCard(padding: 24) {
            VStack(alignment: .leading, spacing: 16) {
                stepLabel("Step 1 of 2 · Join your team")

                Text("Paste the invite code a teammate sent you. That's it — no setup, no accounts to create.")
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.mutedText)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 8) {
                    Image(systemName: "ticket")
                        .foregroundStyle(Brand.mutedText)
                    TextField("Paste your invite code…", text: $inviteCode)
                        .textFieldStyle(.plain)
                        .font(.system(size: 13, design: .monospaced))
                        .onSubmit(joinWithCode)
                }
                .padding(12)
                .background(.white, in: .rect(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Brand.border, lineWidth: 1))

                Button(action: joinWithCode) {
                    Text("Join team")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                }
                .buttonStyle(.glassProminent)
                .tint(Brand.inkSolid)
                .disabled(inviteCode.trimmingCharacters(in: .whitespaces).isEmpty)

                DisclosureGroup(isExpanded: $showAdvanced) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("For whoever set up the database: enter the connection details directly.")
                            .font(.system(size: 11))
                            .foregroundStyle(Brand.mutedText)
                        VStack(alignment: .leading, spacing: 4) {
                            MonoLabel(text: "Project URL")
                            TextField("https://xyzcompany.supabase.co", text: $urlString)
                                .textFieldStyle(.roundedBorder)
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            MonoLabel(text: "Anon (public) key")
                            SecureField("eyJhbGciOi… or sb_publishable_…", text: $anonKey)
                                .textFieldStyle(.roundedBorder)
                        }
                        Button("Connect manually") {
                            state.connect(urlString: urlString, anonKey: anonKey)
                        }
                        .buttonStyle(.glass)
                        .disabled(urlString.isEmpty || anonKey.isEmpty)
                    }
                    .padding(.top, 8)
                } label: {
                    Text("Advanced: connect manually")
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.mutedText)
                }
            }
        }
    }

    private func joinWithCode() {
        guard !inviteCode.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        state.connect(inviteCode: inviteCode)
    }

    // MARK: Step 2 — sign in

    private var signInCard: some View {
        GlassCard(padding: 24) {
            VStack(alignment: .leading, spacing: 16) {
                stepLabel("Step 2 of 2 · Sign in")

                Label {
                    Text("You're connected to the team.")
                        .font(.system(size: 13, weight: .medium))
                } icon: {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Brand.green)
                }

                Text("Now sign in with your Google account — the same one your team added for you.")
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.mutedText)
                    .fixedSize(horizontal: false, vertical: true)

                Button {
                    state.signInWithGoogle()
                } label: {
                    HStack(spacing: 8) {
                        GoogleGMark()
                        Text("Sign in with Google")
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 5)
                }
                .buttonStyle(.glassProminent)
                .tint(Brand.inkSolid)

                if let code = state.inviteCode {
                    Divider()
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Inviting a teammate?")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Brand.ink)
                            Text("Send them the app and this code — that's all they need.")
                                .font(.system(size: 11))
                                .foregroundStyle(Brand.mutedText)
                        }
                        Spacer()
                        Button {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(code, forType: .string)
                        } label: {
                            Label("Copy invite code", systemImage: "doc.on.doc")
                                .font(.system(size: 11, weight: .medium))
                        }
                        .buttonStyle(.glass)
                    }
                }

                Button("Start over with a different team") { state.resetConnection() }
                    .buttonStyle(.plain)
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.mutedText)
            }
        }
    }

    private var checkingCard: some View {
        GlassCard(padding: 24) {
            HStack(spacing: 10) {
                ProgressView().controlSize(.small)
                Text("Checking your team membership…")
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.mutedText)
            }
            .frame(maxWidth: .infinity, alignment: .center)
        }
    }

    private func deniedCard(email: String) -> some View {
        GlassCard(padding: 24) {
            VStack(alignment: .leading, spacing: 12) {
                Label("Almost there — you're not on the team list yet", systemImage: "person.badge.clock")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.ink)
                Text("You signed in as \(email), but that address isn't on the team's member list. Ask a teammate to add you, then try again.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Brand.mutedText)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Try again") { state.signOut() }
                    .buttonStyle(.glass)
            }
        }
    }
}

/// Minimal four-color Google "G" so the sign-in button reads instantly.
private struct GoogleGMark: View {
    var body: some View {
        ZStack {
            Circle().fill(.white)
            Text("G")
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color(red: 0.26, green: 0.52, blue: 0.96),
                                 Color(red: 0.92, green: 0.26, blue: 0.21),
                                 Color(red: 0.98, green: 0.74, blue: 0.02),
                                 Color(red: 0.20, green: 0.66, blue: 0.33)],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    )
                )
        }
        .frame(width: 20, height: 20)
    }
}
