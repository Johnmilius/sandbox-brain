import SandboxBrainKit
import SwiftUI

// Notes — Phase 2 port of the Mac app's Notes section (NotesPromptsView.swift).
// Mac shows an HSplitView (sidebar list + detail); the phone gets a
// NavigationStack list that pushes a detail view. Wiki-links push further
// note details onto the same stack. Editing happens in a sheet instead of
// the Mac's inline editor.

/// Push target for a note detail. Value type so chained wiki-link pushes
/// (note A → note B → note A) each get their own stack entry.
struct NoteRoute: Hashable, Identifiable {
    let id: String
}

/// One-shot latch for the wiki-link verification hook so a link chain
/// (A → B → A …) doesn't auto-follow forever.
@MainActor
enum NoteVerificationHook {
    static var fired = false
}

struct NotesView: View {
    @Environment(AppState.self) private var state
    @State private var creating = false
    /// Programmatic push target used only by the SB_OPEN_NOTE dev hook.
    @State private var hookPushed: NoteRoute?

    var body: some View {
        Page(kicker: "Notes", title: "Team notes", trailing: AnyView(
            Button { creating = true } label: { Label("New", systemImage: "plus") }
                .buttonStyle(.glass)
        )) {
            if state.notes.isEmpty {
                EmptyStateView(symbol: "pencil", title: "No notes yet",
                               message: "Notes support markdown and [[wiki-links]] between each other.")
            } else {
                VStack(spacing: 10) {
                    ForEach(state.notes) { note in
                        NavigationLink(value: NoteRoute(id: note.id)) {
                            noteRow(note)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .toolbarBackground(.hidden, for: .navigationBar)
        .navigationTitle("Notes")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: NoteRoute.self) { route in
            NoteDetailView(noteId: route.id)
        }
        .navigationDestination(item: $hookPushed) { route in
            NoteDetailView(noteId: route.id)
        }
        .sheet(isPresented: $creating) {
            NoteEditorSheet(note: nil)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .task { await applyVerificationHook() }
    }

    /// Dev/verification hook (same SIMCTL_CHILD_SB_* pattern as DemoDriver):
    /// SB_OPEN_NOTE=1 pushes the first note's detail for simulator
    /// screenshots. No-op outside that environment.
    private func applyVerificationHook() async {
        guard ProcessInfo.processInfo.environment["SB_OPEN_NOTE"] == "1" else { return }
        for _ in 0..<40 where state.notes.isEmpty {
            try? await Task.sleep(for: .milliseconds(100))
        }
        if let first = state.notes.first { hookPushed = NoteRoute(id: first.id) }
    }

    private func noteRow(_ note: Note) -> some View {
        FlatCard {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(note.title)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Brand.ink)
                        .lineLimit(1)
                    HStack(spacing: 6) {
                        Text(state.profile(note.authorId)?.displayName.split(separator: " ").first.map(String.init) ?? "")
                        Text(relativeTime(note.updatedAt))
                    }
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Brand.mutedText)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Brand.mutedText)
            }
            .contentShape(.rect)
        }
    }
}

// MARK: - Detail (rendered markdown + tappable wiki-links)

struct NoteDetailView: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss

    let noteId: String
    @State private var editing = false
    /// Wiki-link push target; each detail registers its own destination so
    /// link chains recurse naturally.
    @State private var pushed: NoteRoute?

    private var note: Note? { state.notes.first { $0.id == noteId } }

    var body: some View {
        Group {
            if let note {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(note.title)
                            .font(.system(size: 26, weight: .medium, design: .serif))
                            .foregroundStyle(Brand.ink)
                        MonoLabel(text: "by \(state.profile(note.authorId)?.displayName ?? "unknown") · updated \(relativeTime(note.updatedAt))")
                        GlassCard(padding: 18) {
                            WikiText(body: note.body) { linkedTitle in
                                if let target = state.notes.first(where: { $0.title.lowercased() == linkedTitle.lowercased() }) {
                                    pushed = NoteRoute(id: target.id)
                                }
                            }
                        }
                    }
                    .padding(20)
                    .frame(maxWidth: 800, alignment: .leading)
                    .frame(maxWidth: .infinity)
                }
                .background(Brand.cream)
            } else {
                // Note was deleted underneath us (e.g. teammate refresh).
                EmptyStateView(symbol: "pencil.slash", title: "Note unavailable",
                               message: "This note is gone — it may have been deleted.")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Brand.cream)
            }
        }
        .navigationTitle(note?.title ?? "Note")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            if let note {
                ToolbarItemGroup(placement: .primaryAction) {
                    Button { editing = true } label: { Image(systemName: "pencil") }
                    Button(role: .destructive) {
                        state.perform { [id = note.id, backend = state.backend] in
                            try await backend?.deleteNote(id: id)
                        }
                        dismiss()
                    } label: { Image(systemName: "trash") }
                }
            }
        }
        .navigationDestination(item: $pushed) { route in
            NoteDetailView(noteId: route.id)
        }
        .sheet(isPresented: $editing) {
            if let note {
                NoteEditorSheet(note: note)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
        }
        .task { await applyVerificationHook() }
    }

    /// Dev/verification hooks (same SIMCTL_CHILD_SB_* pattern as DemoDriver),
    /// both one-shot so pushed details don't re-trigger them:
    ///   SB_EDIT_NOTE=1       — open this note's editor sheet
    ///   SB_FOLLOW_WIKILINK=1 — follow the first [[wiki-link]] in the body,
    ///                          exercising the same push path as a tap
    private func applyVerificationHook() async {
        let env = ProcessInfo.processInfo.environment
        guard !NoteVerificationHook.fired, let note else { return }
        if env["SB_EDIT_NOTE"] == "1" {
            NoteVerificationHook.fired = true
            try? await Task.sleep(for: .milliseconds(400))
            editing = true
        } else if env["SB_FOLLOW_WIKILINK"] == "1" {
            NoteVerificationHook.fired = true
            try? await Task.sleep(for: .milliseconds(600))
            if let open = note.body.range(of: "[["),
               let close = note.body.range(of: "]]", range: open.upperBound..<note.body.endIndex) {
                let title = String(note.body[open.upperBound..<close.lowerBound])
                if let target = state.notes.first(where: { $0.title.lowercased() == title.lowercased() }) {
                    pushed = NoteRoute(id: target.id)
                }
            }
        }
    }
}

// MARK: - Editor sheet (create + edit)

struct NoteEditorSheet: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss

    let note: Note?
    @State private var title = ""
    @State private var bodyText = ""

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 10) {
                TextField("Title", text: $title)
                    .font(.system(size: 20, weight: .medium, design: .serif))
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 4)
                MonoLabel(text: "Markdown · [[wiki-links]]")
                    .padding(.horizontal, 4)
                // TextEditor scrolls internally, so the medium detent still
                // reaches the whole body.
                TextEditor(text: $bodyText)
                    .font(.system(size: 15))
                    .scrollContentBackground(.hidden)
                    .padding(8)
                    .background(Brand.accentField.opacity(0.6), in: .rect(cornerRadius: 12))
                    .frame(maxHeight: .infinity)
            }
            .padding(16)
            .background(Brand.cream)
            .navigationTitle(note == nil ? "New note" : "Edit note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(title.isEmpty)
                }
            }
            .onAppear {
                if let note {
                    title = note.title
                    bodyText = note.body
                }
            }
        }
    }

    private func save() {
        if var updated = note {
            updated.title = title
            updated.body = bodyText
            state.perform { [backend = state.backend] in try await backend?.updateNote(updated) }
        } else {
            state.perform { [title, bodyText, backend = state.backend] in
                try await backend?.createNote(title: title, body: bodyText)
            }
        }
        dismiss()
    }
}

// MARK: - WikiText (iOS port)

/// Renders note text line-by-line, turning [[wiki-links]] into tappable
/// links. Ported from the Mac app; the Mac laid out link fragments in an
/// HStack (which can't wrap), so on the phone each line is built as one
/// AttributedString with embedded link URLs — text wraps naturally and the
/// taps route through a local OpenURLAction.
struct WikiText: View {
    let body_: String
    let onLink: (String) -> Void

    private static let scheme = "sandboxbrain-note"

    init(body: String, onLink: @escaping (String) -> Void) {
        self.body_ = body
        self.onLink = onLink
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(body_.components(separatedBy: "\n").enumerated()), id: \.offset) { _, line in
                Text(attributed(line))
                    .font(.system(size: 15))
                    .foregroundStyle(Brand.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .environment(\.openURL, OpenURLAction { url in
            guard url.scheme == Self.scheme else { return .systemAction }
            onLink(url.lastPathComponent)
            return .handled
        })
    }

    private enum Piece { case text(String), link(String) }

    private func attributed(_ line: String) -> AttributedString {
        var result = AttributedString()
        for piece in splitWikiLinks(line) {
            switch piece {
            case .text(let t):
                result += markdownish(t)
            case .link(let title):
                var fragment = AttributedString(title)
                fragment.font = .system(size: 15, weight: .medium)
                fragment.foregroundColor = Brand.purple
                fragment.underlineStyle = .single
                if let encoded = title.addingPercentEncoding(withAllowedCharacters: .alphanumerics),
                   let url = URL(string: "\(Self.scheme)://note/\(encoded)") {
                    fragment.link = url
                }
                result += fragment
            }
        }
        return result
    }

    private func splitWikiLinks(_ line: String) -> [Piece] {
        var pieces: [Piece] = []
        var rest = Substring(line)
        while let open = rest.range(of: "[["), let close = rest.range(of: "]]", range: open.upperBound..<rest.endIndex) {
            if open.lowerBound > rest.startIndex {
                pieces.append(.text(String(rest[rest.startIndex..<open.lowerBound])))
            }
            pieces.append(.link(String(rest[open.upperBound..<close.lowerBound])))
            rest = rest[close.upperBound...]
        }
        if !rest.isEmpty { pieces.append(.text(String(rest))) }
        return pieces.isEmpty ? [.text(line)] : pieces
    }

    private func markdownish(_ s: String) -> AttributedString {
        (try? AttributedString(markdown: s, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(s)
    }
}
