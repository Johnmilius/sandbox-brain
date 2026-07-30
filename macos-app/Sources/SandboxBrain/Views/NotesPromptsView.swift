import SandboxBrainKit
import SwiftUI

// MARK: - Notes (list + markdown editor with [[wiki-links]])

struct NotesView: View {
    @Environment(AppState.self) private var state
    @State private var selectedId: String?
    @State private var draftTitle = ""
    @State private var draftBody = ""
    @State private var isEditing = false

    private var selected: Note? { state.notes.first { $0.id == selectedId } }

    var body: some View {
        HSplitView {
            noteList
                .frame(minWidth: 240, maxWidth: 320)
            detail
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Brand.cream)
    }

    private var noteList: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                MonoLabel(text: "Notes")
                Spacer()
                Button {
                    state.perform { [backend = state.backend] in
                        try await backend?.createNote(title: "Untitled \(Int(Date().timeIntervalSince1970) % 10000)", body: "")
                    }
                } label: { Image(systemName: "plus") }
                    .buttonStyle(.glass)
                    .help("New note")
            }
            .padding(12)
            List(state.notes, id: \.id, selection: $selectedId) { note in
                VStack(alignment: .leading, spacing: 2) {
                    Text(note.title).font(.system(size: 13, weight: .medium)).lineLimit(1)
                    HStack(spacing: 6) {
                        Text(state.profile(note.authorId)?.displayName.split(separator: " ").first.map(String.init) ?? "")
                        Text(relativeTime(note.updatedAt))
                    }
                    .font(.system(size: 10.5, design: .monospaced))
                    .foregroundStyle(Brand.mutedText)
                }
                .tag(note.id)
            }
            .listStyle(.sidebar)
            .scrollContentBackground(.hidden)
        }
    }

    @ViewBuilder
    private var detail: some View {
        if let note = selected {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        if isEditing {
                            TextField("Title", text: $draftTitle)
                                .font(.system(size: 24, weight: .medium, design: .serif))
                                .textFieldStyle(.plain)
                        } else {
                            Text(note.title)
                                .font(.system(size: 24, weight: .medium, design: .serif))
                                .foregroundStyle(Brand.ink)
                        }
                        Spacer()
                        if isEditing {
                            Button("Save") {
                                var updated = note
                                updated.title = draftTitle
                                updated.body = draftBody
                                state.perform { [backend = state.backend] in try await backend?.updateNote(updated) }
                                isEditing = false
                            }
                            .buttonStyle(.glassProminent).tint(Brand.inkSolid)
                            Button("Cancel") { isEditing = false }
                        } else {
                            Button { startEditing(note) } label: { Image(systemName: "pencil") }
                                .buttonStyle(.glass)
                            Button {
                                state.perform { [id = note.id, backend = state.backend] in try await backend?.deleteNote(id: id) }
                                selectedId = nil
                            } label: { Image(systemName: "trash") }
                                .buttonStyle(.glass)
                        }
                    }
                    MonoLabel(text: "by \(state.profile(note.authorId)?.displayName ?? "unknown") · updated \(relativeTime(note.updatedAt))")

                    if isEditing {
                        TextEditor(text: $draftBody)
                            .font(.system(size: 13))
                            .scrollContentBackground(.hidden)
                            .frame(minHeight: 380)
                            .padding(10)
                            .glassEffect(.regular, in: .rect(cornerRadius: 12))
                    } else {
                        GlassCard(padding: 18) {
                            WikiText(body: note.body) { linkedTitle in
                                if let target = state.notes.first(where: { $0.title.lowercased() == linkedTitle.lowercased() }) {
                                    selectedId = target.id
                                }
                            }
                        }
                    }
                }
                .padding(24)
                .frame(maxWidth: 800, alignment: .leading)
            }
        } else {
            EmptyStateView(symbol: "pencil", title: "Pick a note", message: "Notes support markdown and [[wiki-links]] between each other.")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func startEditing(_ note: Note) {
        draftTitle = note.title
        draftBody = note.body
        isEditing = true
    }
}

/// Renders note text line-by-line, turning [[wiki-links]] into tappable links.
struct WikiText: View {
    let body_: String
    let onLink: (String) -> Void

    init(body: String, onLink: @escaping (String) -> Void) {
        self.body_ = body
        self.onLink = onLink
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(body_.components(separatedBy: "\n").enumerated()), id: \.offset) { _, line in
                lineView(line)
            }
        }
    }

    @ViewBuilder
    private func lineView(_ line: String) -> some View {
        let pieces = splitWikiLinks(line)
        if pieces.count == 1, case .text(let t) = pieces[0] {
            Text(markdownish(t))
                .font(.system(size: 13))
                .foregroundStyle(Brand.ink)
                .fixedSize(horizontal: false, vertical: true)
        } else {
            // Line contains wiki-links: lay out as wrapping fragments.
            HStack(spacing: 0) {
                ForEach(Array(pieces.enumerated()), id: \.offset) { _, piece in
                    switch piece {
                    case .text(let t):
                        Text(markdownish(t)).font(.system(size: 13)).foregroundStyle(Brand.ink)
                    case .link(let title):
                        Button { onLink(title) } label: {
                            Text(title)
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Brand.purple)
                                .underline()
                        }
                        .buttonStyle(.plain)
                    }
                }
                Spacer(minLength: 0)
            }
        }
    }

    private enum Piece { case text(String), link(String) }

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

// MARK: - Prompts (library with favorites, ratings, copy)

struct PromptsView: View {
    @Environment(AppState.self) private var state
    @State private var editing: Prompt?
    @State private var creating = false
    @State private var favoritesOnly = false

    var body: some View {
        Page(kicker: "Prompts", title: "The prompt library", trailing: AnyView(
            HStack {
                Toggle("Favorites", isOn: $favoritesOnly).toggleStyle(.button)
                Button { creating = true } label: { Label("New prompt", systemImage: "plus") }
                    .buttonStyle(.glass)
            }
        )) {
            let shown = state.prompts.filter { !favoritesOnly || $0.isFavorite }
            if shown.isEmpty {
                EmptyStateView(symbol: "quote.opening", title: "No prompts", message: "Save the prompts that work so the team can reuse them.")
            }
            ForEach(shown) { prompt in
                promptCard(prompt)
            }
        }
        .sheet(item: $editing) { PromptSheet(prompt: $0) }
        .sheet(isPresented: $creating) { PromptSheet(prompt: nil) }
    }

    private func promptCard(_ prompt: Prompt) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Button {
                        var updated = prompt
                        updated.isFavorite.toggle()
                        state.perform { [backend = state.backend] in try await backend?.updatePrompt(updated) }
                    } label: {
                        Image(systemName: prompt.isFavorite ? "star.fill" : "star")
                            .foregroundStyle(prompt.isFavorite ? .orange : Brand.mutedText)
                    }
                    .buttonStyle(.plain)
                    .help(prompt.isFavorite ? "Unfavorite" : "Team favorite")

                    Text(prompt.title)
                        .font(.system(size: 15, weight: .semibold, design: .serif))
                        .foregroundStyle(Brand.ink)
                    if let tool = prompt.aiTool {
                        StatusPill(label: tool, color: Brand.purple)
                    }
                    if let rating = prompt.rating {
                        HStack(spacing: 1) {
                            ForEach(0..<5, id: \.self) { i in
                                Image(systemName: i < rating ? "star.fill" : "star")
                                    .font(.system(size: 8))
                                    .foregroundStyle(i < rating ? .orange : Brand.border)
                            }
                        }
                    }
                    Spacer()
                    Button {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(prompt.promptText, forType: .string)
                    } label: { Image(systemName: "doc.on.doc").font(.system(size: 11)) }
                        .buttonStyle(.glass)
                        .help("Copy prompt")
                    Button { editing = prompt } label: { Image(systemName: "pencil").font(.system(size: 11)) }
                        .buttonStyle(.glass)
                }
                Text(prompt.promptText)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(Brand.ink.opacity(0.85))
                    .lineLimit(3)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Brand.accentField.opacity(0.6), in: .rect(cornerRadius: 8))
                if let notes = prompt.responseNotes, !notes.isEmpty {
                    Text(notes).font(.system(size: 11.5)).foregroundStyle(Brand.mutedText).lineLimit(2)
                }
                MonoLabel(text: "\(state.profile(prompt.userId)?.displayName ?? "unknown") · \(relativeTime(prompt.updatedAt))\(state.project(prompt.projectId).map { " · \($0.name)" } ?? "")")
            }
        }
    }
}

struct PromptSheet: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss

    let prompt: Prompt?
    @State private var title = ""
    @State private var text = ""
    @State private var responseNotes = ""
    @State private var aiTool = ""
    @State private var rating = 0
    @State private var projectId = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(prompt == nil ? "New prompt" : "Edit prompt")
                .font(.system(size: 20, weight: .medium, design: .serif))
            TextField("Title", text: $title).textFieldStyle(.roundedBorder)
            TextEditor(text: $text)
                .font(.system(size: 12, design: .monospaced))
                .frame(height: 120)
                .scrollContentBackground(.hidden)
                .padding(6)
                .background(Brand.accentField.opacity(0.6), in: .rect(cornerRadius: 8))
            TextField("What came back / what worked", text: $responseNotes, axis: .vertical)
                .lineLimit(2...3).textFieldStyle(.roundedBorder)
            HStack {
                TextField("AI tool (claude, cursor…)", text: $aiTool).textFieldStyle(.roundedBorder)
                Picker("Rating", selection: $rating) {
                    Text("—").tag(0)
                    ForEach(1...5, id: \.self) { Text(String(repeating: "★", count: $0)).tag($0) }
                }
                .frame(width: 140)
            }
            Picker("Project", selection: $projectId) {
                Text("No project").tag("")
                ForEach(state.projects) { Text($0.name).tag($0.id) }
            }
            HStack {
                if let prompt {
                    Button("Delete", role: .destructive) {
                        state.perform { [id = prompt.id, backend = state.backend] in try await backend?.deletePrompt(id: id) }
                        dismiss()
                    }
                }
                Spacer()
                Button("Cancel") { dismiss() }
                Button("Save") { save() }
                    .buttonStyle(.glassProminent).tint(Brand.inkSolid)
                    .disabled(title.isEmpty || text.isEmpty)
            }
        }
        .padding(22)
        .frame(width: 500)
        .onAppear {
            if let prompt {
                title = prompt.title
                text = prompt.promptText
                responseNotes = prompt.responseNotes ?? ""
                aiTool = prompt.aiTool ?? ""
                rating = prompt.rating ?? 0
                projectId = prompt.projectId ?? ""
            }
        }
    }

    private func save() {
        if var updated = prompt {
            updated.title = title
            updated.promptText = text
            updated.responseNotes = responseNotes.isEmpty ? nil : responseNotes
            updated.aiTool = aiTool.isEmpty ? nil : aiTool
            updated.rating = rating == 0 ? nil : rating
            updated.projectId = projectId.isEmpty ? nil : projectId
            state.perform { [backend = state.backend] in try await backend?.updatePrompt(updated) }
        } else {
            state.perform { [title, text, responseNotes, aiTool, rating, projectId, backend = state.backend] in
                try await backend?.createPrompt(title: title, text: text, responseNotes: responseNotes.isEmpty ? nil : responseNotes, aiTool: aiTool.isEmpty ? nil : aiTool, rating: rating == 0 ? nil : rating, projectId: projectId.isEmpty ? nil : projectId)
            }
        }
        dismiss()
    }
}
