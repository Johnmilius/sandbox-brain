import SandboxBrainKit
import SwiftUI

// Prompts — Phase 2 port of the Mac app's Prompts section
// (NotesPromptsView.swift). Card list with favorites filter, star toggle,
// rating, copy-to-clipboard (UIPasteboard here, NSPasteboard on Mac) and a
// create/edit sheet rebuilt as a phone Form with detents.

struct PromptsView: View {
    @Environment(AppState.self) private var state
    @State private var editing: Prompt?
    @State private var creating = false
    @State private var favoritesOnly = false
    /// Briefly swaps the copy icon to a checkmark for feedback.
    @State private var copiedId: String?

    var body: some View {
        Page(kicker: "Prompts", title: "The prompt library", trailing: AnyView(
            HStack(spacing: 8) {
                Button { favoritesOnly.toggle() } label: {
                    Image(systemName: favoritesOnly ? "star.fill" : "star")
                        .foregroundStyle(favoritesOnly ? .orange : Brand.ink)
                }
                .buttonStyle(.glass)
                Button { creating = true } label: { Label("New", systemImage: "plus") }
                    .buttonStyle(.glass)
            }
        )) {
            let shown = state.prompts.filter { !favoritesOnly || $0.isFavorite }
            if shown.isEmpty {
                EmptyStateView(symbol: "quote.opening", title: "No prompts",
                               message: "Save the prompts that work so the team can reuse them.")
            }
            ForEach(shown) { prompt in
                promptCard(prompt)
            }
        }
        .toolbarBackground(.hidden, for: .navigationBar)
        .navigationTitle("Prompts")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $editing) {
            PromptSheet(prompt: $0)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $creating) {
            PromptSheet(prompt: nil)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }

    private func promptCard(_ prompt: Prompt) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 8) {
                // Mac fits star/title/pills/actions in one row; the phone
                // splits it: title + actions on top, metadata pills below.
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

                    Text(prompt.title)
                        .font(.system(size: 15, weight: .semibold, design: .serif))
                        .foregroundStyle(Brand.ink)
                        .lineLimit(1)
                    Spacer()
                    Button {
                        UIPasteboard.general.string = prompt.promptText
                        withAnimation { copiedId = prompt.id }
                        Task {
                            try? await Task.sleep(for: .seconds(1.5))
                            if copiedId == prompt.id { withAnimation { copiedId = nil } }
                        }
                    } label: {
                        Image(systemName: copiedId == prompt.id ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 12))
                            .foregroundStyle(copiedId == prompt.id ? Brand.green : Brand.ink)
                    }
                    .buttonStyle(.glass)
                    Button { editing = prompt } label: { Image(systemName: "pencil").font(.system(size: 12)) }
                        .buttonStyle(.glass)
                }
                HStack(spacing: 8) {
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
        NavigationStack {
            Form {
                TextField("Title", text: $title)
                SwiftUI.Section("Prompt") {
                    TextEditor(text: $text)
                        .font(.system(size: 13, design: .monospaced))
                        .frame(minHeight: 120)
                }
                SwiftUI.Section {
                    TextField("What came back / what worked", text: $responseNotes, axis: .vertical)
                        .lineLimit(2...4)
                    TextField("AI tool (claude, cursor…)", text: $aiTool)
                        .textInputAutocapitalization(.never)
                    Picker("Rating", selection: $rating) {
                        Text("—").tag(0)
                        ForEach(1...5, id: \.self) { Text(String(repeating: "★", count: $0)).tag($0) }
                    }
                    Picker("Project", selection: $projectId) {
                        Text("No project").tag("")
                        ForEach(state.projects) { Text($0.name).tag($0.id) }
                    }
                }
                if let prompt {
                    SwiftUI.Section {
                        Button("Delete prompt", role: .destructive) {
                            state.perform { [id = prompt.id, backend = state.backend] in
                                try await backend?.deletePrompt(id: id)
                            }
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle(prompt == nil ? "New prompt" : "Edit prompt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(title.isEmpty || text.isEmpty)
                }
            }
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
