import SandboxBrainKit
import SwiftUI

// Brain — Phase 2 port of the Mac app's Brain section
// (BrainIdeasAgentsView.swift). Knowledge items filtered by kind; the Mac's
// inline chip row becomes a horizontal scroller on the phone, and the
// create/edit sheet becomes a Form with detents (the Mac's segmented kind
// picker won't fit five segments on a phone, so it's a menu picker here).

struct BrainView: View {
    @Environment(AppState.self) private var state
    @State private var kindFilter: KnowledgeKind?
    @State private var editing: KnowledgeItem?
    @State private var creating = false

    var body: some View {
        Page(kicker: "Brain", title: "Team knowledge", trailing: AnyView(
            Button { creating = true } label: { Label("Add", systemImage: "plus") }
                .buttonStyle(.glass)
        )) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    filterChip(nil, label: "All")
                    ForEach(KnowledgeKind.allCases, id: \.self) { kind in
                        filterChip(kind, label: kind.label)
                    }
                }
                .padding(.vertical, 2)
            }
            .scrollClipDisabled()
            let shown = state.knowledge.filter { kindFilter == nil || $0.kind == kindFilter }
            if shown.isEmpty {
                EmptyStateView(symbol: "brain", title: "Nothing here yet",
                               message: "Capture decisions, snippets, docs, and contacts so they outlive the chat scroll.")
            }
            ForEach(shown) { item in
                Button { editing = item } label: { knowledgeCard(item) }
                    .buttonStyle(.plain)
            }
        }
        .toolbarBackground(.hidden, for: .navigationBar)
        .navigationTitle("Brain")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $editing) {
            KnowledgeSheet(item: $0)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $creating) {
            KnowledgeSheet(item: nil)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }

    private func filterChip(_ kind: KnowledgeKind?, label: String) -> some View {
        Button {
            kindFilter = kind
        } label: {
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
        }
        .buttonStyle(.plain)
        .glassEffect(kindFilter == kind ? .regular.tint(Brand.inkSolid.opacity(0.85)) : .regular, in: .capsule)
        .foregroundStyle(kindFilter == kind ? .white : Brand.ink)
    }

    private func knowledgeCard(_ item: KnowledgeItem) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: item.kind.symbol)
                        .font(.system(size: 12))
                        .foregroundStyle(Brand.purple)
                        .padding(.top, 3)
                    Text(item.title)
                        .font(.system(size: 15, weight: .semibold, design: .serif))
                        .foregroundStyle(Brand.ink)
                        .multilineTextAlignment(.leading)
                    Spacer()
                    if let url = item.url, let parsed = URL(string: url) {
                        Link(destination: parsed) {
                            Image(systemName: "arrow.up.right.square").font(.system(size: 12))
                        }
                    }
                }
                StatusPill(label: item.kind.label, color: Brand.mutedText)
                if let description = item.description, !description.isEmpty {
                    Text(description).font(.system(size: 12)).foregroundStyle(Brand.mutedText).lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                if item.kind == .codeSnippet, let content = item.content, !content.isEmpty {
                    Text(content)
                        .font(.system(size: 11, design: .monospaced))
                        .lineLimit(4)
                        .multilineTextAlignment(.leading)
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Brand.ink.opacity(0.05), in: .rect(cornerRadius: 6))
                }
                MonoLabel(text: "\(state.profile(item.createdBy)?.displayName ?? "unknown") · \(relativeTime(item.updatedAt))\(state.project(item.projectId).map { " · \($0.name)" } ?? "")")
            }
            .contentShape(.rect)
        }
    }
}

struct KnowledgeSheet: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss

    let item: KnowledgeItem?
    @State private var kind: KnowledgeKind = .decision
    @State private var title = ""
    @State private var description = ""
    @State private var content = ""
    @State private var url = ""
    @State private var projectId = ""

    var body: some View {
        NavigationStack {
            Form {
                Picker("Kind", selection: $kind) {
                    ForEach(KnowledgeKind.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                TextField("Title", text: $title)
                TextField("Description", text: $description, axis: .vertical)
                    .lineLimit(2...4)
                SwiftUI.Section("Content") {
                    TextEditor(text: $content)
                        .font(.system(size: 13, design: kind == .codeSnippet ? .monospaced : .default))
                        .frame(minHeight: 110)
                }
                SwiftUI.Section {
                    TextField("URL (optional)", text: $url)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Picker("Project", selection: $projectId) {
                        Text("No project").tag("")
                        ForEach(state.projects) { Text($0.name).tag($0.id) }
                    }
                }
                if let item {
                    SwiftUI.Section {
                        Button("Delete knowledge", role: .destructive) {
                            state.perform { [id = item.id, backend = state.backend] in
                                try await backend?.deleteKnowledgeItem(id: id)
                            }
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle(item == nil ? "Add knowledge" : "Edit knowledge")
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
                if let item {
                    kind = item.kind
                    title = item.title
                    description = item.description ?? ""
                    content = item.content ?? ""
                    url = item.url ?? ""
                    projectId = item.projectId ?? ""
                }
            }
        }
    }

    private func save() {
        if var updated = item {
            updated.kind = kind
            updated.title = title
            updated.description = description.isEmpty ? nil : description
            updated.content = content.isEmpty ? nil : content
            updated.url = url.isEmpty ? nil : url
            updated.projectId = projectId.isEmpty ? nil : projectId
            state.perform { [backend = state.backend] in try await backend?.updateKnowledgeItem(updated) }
        } else {
            state.perform { [kind, title, description, content, url, projectId, backend = state.backend] in
                try await backend?.createKnowledgeItem(kind: kind, title: title, description: description.isEmpty ? nil : description, content: content.isEmpty ? nil : content, url: url.isEmpty ? nil : url, projectId: projectId.isEmpty ? nil : projectId)
            }
        }
        dismiss()
    }
}
