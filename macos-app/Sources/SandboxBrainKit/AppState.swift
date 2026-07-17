#if os(macOS)
import AppKit
#elseif os(iOS)
import UIKit
#endif
import AuthenticationServices
import SwiftUI

// MARK: - App phases

public enum AppPhase: Equatable {
    case onboarding          // no connection configured yet
    case signedOut           // configured, needs Google sign-in
    case checkingAccess      // session exists, verifying allowlist
    case denied(String)      // signed in but not on allowed_emails
    case ready               // signed in + allowlisted (or demo)
}

// MARK: - Central observable state

@MainActor
@Observable
public final class AppState {
    public var phase: AppPhase = .onboarding
    public var isDemo = false
    public var backend: BrainBackend?
    public var currentUserId: String?
    public var lastError: String?
    /// Drives the branded launch overlay: true on cold boot and whenever a
    /// workspace is loading; always shown for a minimum beat so it reads.
    public var showLaunchOverlay = true
    /// Set by SnapshotMode to drive RootView's selection programmatically.
    public var forcedSection: Section?

    // Cached table data — every view reads these; refresh() reloads them.
    public var profiles: [Profile] = []
    public var projects: [Project] = []
    public var entries: [TimeEntry] = []
    public var tasks: [TaskItem] = []
    public var notes: [Note] = []
    public var prompts: [Prompt] = []
    public var knowledge: [KnowledgeItem] = []
    public var agents: [Agent] = []
    public var ideas: [Idea] = []
    public var modules: [AcademyModule] = []
    public var steps: [AcademyStep] = []
    public var progress: [StepProgress] = []
    public var outcomes: [AcademyOutcome] = []
    public var assessments: [OutcomeAssessment] = []
    public var links: [EntityLink] = []

    public init() {
        // Reconnect from Keychain on launch; fall back to onboarding.
        if let config = ConfigStore.load(),
           let parsed = URL(string: config.supabaseURL) {
            let key = config.anonKey
            let live = LiveBackend(url: parsed, anonKey: key)
            backend = live
            phase = .checkingAccess
            revealAfterLoad { await self.resumeSession(live) }
        } else {
            revealAfterLoad {}
        }
    }

    /// Show the launch overlay while `load` runs, holding it at least
    /// `minimum` seconds so the animation lands instead of flashing.
    private func revealAfterLoad(minimum: Double = 1.7, load: @escaping () async -> Void) {
        showLaunchOverlay = true
        let started = Date()
        Task {
            await load()
            let remaining = minimum - Date().timeIntervalSince(started)
            if remaining > 0 { try? await Task.sleep(for: .seconds(remaining)) }
            showLaunchOverlay = false
        }
    }

    // MARK: lookups

    public func profile(_ id: String?) -> Profile? {
        guard let id else { return nil }
        return profiles.first { $0.id == id }
    }

    public func project(_ id: String?) -> Project? {
        guard let id else { return nil }
        return projects.first { $0.id == id }
    }

    public var runningEntries: [TimeEntry] { entries.filter(\.isRunning) }
    public var myRunningEntry: TimeEntry? { runningEntries.first { $0.userId == currentUserId } }

    // MARK: onboarding / auth

    public func startDemo() {
        backend = DemoBackend()
        isDemo = true
        currentUserId = DemoStore.lukeId
        phase = .ready
        revealAfterLoad { await self.refresh() }
    }

    // MARK: invite codes — one pasteable string carrying URL + anon key,
    // so non-technical teammates never see Supabase jargon.

    public nonisolated static let inviteCodePrefix = "SBRAIN1:"

    /// Build the shareable code from a URL + anon key. Pure — the `|` join and
    /// base64 encoding are the exact inverse of `decodeInviteCode`.
    public nonisolated static func makeInviteCode(urlString: String, anonKey: String) -> String {
        inviteCodePrefix + Data("\(urlString)|\(anonKey)".utf8).base64EncodedString()
    }

    /// Decode a pasted invite code back into its URL + anon key. Pure and
    /// side-effect-free (returns nil for anything that isn't a valid code) so
    /// it can be unit-tested without touching disk or the network.
    public nonisolated static func decodeInviteCode(_ raw: String) -> (urlString: String, anonKey: String)? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.hasPrefix(inviteCodePrefix),
              let data = Data(base64Encoded: String(trimmed.dropFirst(inviteCodePrefix.count))),
              let decoded = String(data: data, encoding: .utf8),
              let separator = decoded.firstIndex(of: "|")
        else { return nil }
        return (String(decoded[..<separator]),
                String(decoded[decoded.index(after: separator)...]))
    }

    /// Outcome of validating a pasted connection: either the parsed values or a
    /// user-facing message explaining what's wrong. (Not `Result` — the message
    /// is guidance to show, not a thrown `Error`.)
    public enum ConnectionValidation {
        case valid(url: URL, urlString: String, anonKey: String)
        case invalid(String)
    }

    /// Validate a project URL + anon key. Pure, so the error paths are
    /// unit-tested without constructing a client or writing config.
    public nonisolated static func validateConnection(urlString: String, anonKey: String) -> ConnectionValidation {
        let trimmedURL = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedKey = anonKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmedURL), url.scheme == "https" else {
            return .invalid("The project URL should look like https://xyzcompany.supabase.co")
        }
        // Common mix-up: pasting the dashboard address instead of the API URL.
        if url.host()?.hasSuffix("supabase.com") == true {
            return .invalid("That's the Supabase dashboard address. Use the Project URL from Settings → API instead — it looks like https://xyzcompany.supabase.co")
        }
        guard !trimmedKey.isEmpty else {
            return .invalid("Paste the anon (public) key from Supabase → Settings → API.")
        }
        // Preserve the pasted (trimmed) string for storage so the invite-code
        // round-trip is byte-identical; `url` is for building the client.
        return .valid(url: url, urlString: trimmedURL, anonKey: trimmedKey)
    }

    /// Generate the shareable code from the stored connection.
    public var inviteCode: String? {
        guard let config = ConfigStore.load() else { return nil }
        return Self.makeInviteCode(urlString: config.supabaseURL, anonKey: config.anonKey)
    }

    public func connect(inviteCode raw: String) {
        guard let decoded = Self.decodeInviteCode(raw) else {
            lastError = "That doesn't look like a Sandbox Brain invite code. Ask a teammate to send a fresh one (⋯ menu → Copy team invite code)."
            return
        }
        connect(urlString: decoded.urlString, anonKey: decoded.anonKey)
    }

    public func connect(urlString: String, anonKey: String) {
        switch Self.validateConnection(urlString: urlString, anonKey: anonKey) {
        case .invalid(let message):
            lastError = message
        case .valid(let url, let trimmedURL, let trimmedKey):
            ConfigStore.save(.init(supabaseURL: trimmedURL, anonKey: trimmedKey))
            let live = LiveBackend(url: url, anonKey: trimmedKey)
            backend = live
            isDemo = false
            phase = .signedOut
        }
    }

    public func signInWithGoogle() {
        guard let live = backend as? LiveBackend else { return }
        Task {
            do {
                do {
                    // Primary: in-window sheet via the app's custom scheme
                    // (sandboxbrain://auth-callback is on the allowlist).
                    _ = try await live.client.auth.signInWithOAuth(
                        provider: .google,
                        redirectTo: URL(string: "sandboxbrain://auth-callback")
                    ) { [webAuth] url in
                        try await webAuth.authenticate(url: url, callbackScheme: "sandboxbrain")
                    }
                } catch let error as ASWebAuthenticationSessionError where error.code == .canceledLogin {
                    return // user closed the sheet — not a failure
                } catch {
                    // Fallback: loopback in the default browser. The dedicated
                    // port (AuthLoopback.port) is allowlisted alongside the
                    // custom scheme and stays clear of dev-server ports.
                    _ = try await live.client.auth.signInWithOAuth(
                        provider: .google,
                        redirectTo: AuthLoopback.redirectURL
                    ) { url in
                        try await LoopbackCallbackServer.run(port: AuthLoopback.port, openURL: url)
                    }
                }
                revealAfterLoad { await self.checkAccess(live) }
            } catch {
                lastError = "Sign-in failed: \(error.localizedDescription)"
            }
        }
    }

    private let webAuth = WebAuthCoordinator()

    private func resumeSession(_ live: LiveBackend) async {
        // No stored session → show the sign-in screen.
        guard (try? await live.client.auth.session) != nil else {
            phase = .signedOut
            return
        }
        await checkAccess(live)
    }

    private func checkAccess(_ live: LiveBackend) async {
        phase = .checkingAccess
        currentUserId = await live.currentUserId()
        let email = (try? await live.client.auth.session.user.email) ?? ""
        do {
            if try await live.isTeamMember() {
                phase = .ready
                await refresh()
            } else {
                await live.signOut()
                phase = .denied(email)
            }
        } catch {
            lastError = "Couldn't verify team access: \(error.localizedDescription)"
            phase = .signedOut
        }
    }

    public func signOut() {
        let b = backend
        Task { await b?.signOut() }
        if isDemo {
            backend = nil
            isDemo = false
            phase = ConfigStore.load() != nil ? .signedOut : .onboarding
        } else {
            phase = .signedOut
        }
        currentUserId = nil
    }

    public func resetConnection() {
        Task { await backend?.signOut() }
        ConfigStore.clear()
        backend = nil
        isDemo = false
        currentUserId = nil
        phase = .onboarding
    }

    // MARK: data loading

    public func refresh() async {
        guard let backend else { return }
        if currentUserId == nil { currentUserId = await backend.currentUserId() }
        do {
            async let p = backend.profiles()
            async let pr = backend.projects()
            async let te = backend.timeEntries(since: Calendar.current.date(byAdding: .day, value: -90, to: Date()))
            async let tk = backend.tasks()
            async let no = backend.notes()
            async let pm = backend.prompts()
            async let kn = backend.knowledgeItems()
            async let ag = backend.agents()
            async let id = backend.ideas()
            async let li = backend.links()
            profiles = try await p
            projects = try await pr
            entries = try await te
            tasks = try await tk
            notes = try await no
            prompts = try await pm
            knowledge = try await kn
            agents = try await ag
            ideas = try await id
            links = try await li
            async let mo = backend.academyModules()
            async let st = backend.academySteps()
            async let pg = backend.stepProgress()
            async let oc = backend.outcomes()
            async let asm = backend.assessments()
            modules = try await mo
            steps = try await st
            progress = try await pg
            outcomes = try await oc
            assessments = try await asm
        } catch {
            lastError = "Refresh failed: \(error.localizedDescription)"
        }
    }

    /// Run a mutation, then refresh; surfaces failures in `lastError`.
    /// Refreshes on failure too, so optimistic UI updates get rolled back
    /// to the database's truth instead of lingering.
    public func perform(_ op: @escaping () async throws -> Void) {
        Task {
            do {
                try await op()
            } catch {
                lastError = error.localizedDescription
            }
            await refresh()
        }
    }
}


// MARK: - ASWebAuthenticationSession wrapper (in-window OAuth sheet)

final class WebAuthCoordinator: NSObject, ASWebAuthenticationPresentationContextProviding, Sendable {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        MainActor.assumeIsolated { () -> ASPresentationAnchor in
            #if os(macOS)
            return NSApplication.shared.keyWindow ?? NSApplication.shared.windows.first ?? ASPresentationAnchor()
            #else
            // Anchor to the foreground scene's key window (UIKit equivalent of
            // NSApplication.keyWindow above).
            let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
            return scene?.keyWindow ?? scene?.windows.first ?? ASPresentationAnchor()
            #endif
        }
    }

    @MainActor
    func authenticate(url: URL, callbackScheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            // @Sendable: Apple invokes this on a background XPC queue; without
            // it the closure inherits @MainActor isolation and traps (SIGTRAP).
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { @Sendable callbackURL, error in
                if let callbackURL {
                    continuation.resume(returning: callbackURL)
                } else {
                    continuation.resume(throwing: error ?? URLError(.userCancelledAuthentication))
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }
    }
}
