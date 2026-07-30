import SandboxBrainKit
import SwiftUI

// MARK: - Brain (knowledge items by kind)

struct BrainView: View {
    @Environment(AppState.self) private var state
    @State private var kindFilter: KnowledgeKind?
    @State private var editing: KnowledgeItem?
    @State private var creating = false

    var body: some View {
        Page(kicker: "Brain", title: "Team knowledge", trailing: AnyView(
            Button { creating = true } label: { Label("Add knowledge", systemImage: "plus") }
                .buttonStyle(.glass)
        )) {
            HStack(spacing: 8) {
                filterChip(nil, label: "All")
                ForEach(KnowledgeKind.allCases, id: \.self) { kind in
                    filterChip(kind, label: kind.label)
                }
            }
            let shown = state.knowledge.filter { kindFilter == nil || $0.kind == kindFilter }
            if shown.isEmpty {
                EmptyStateView(symbol: "brain", title: "Nothing here yet", message: "Capture decisions, snippets, docs, and contacts so they outlive the chat scroll.")
            }
            ForEach(shown) { item in
                Button { editing = item } label: { knowledgeCard(item) }
                    .buttonStyle(.plain)
            }
        }
        .sheet(item: $editing) { KnowledgeSheet(item: $0) }
        .sheet(isPresented: $creating) { KnowledgeSheet(item: nil) }
    }

    private func filterChip(_ kind: KnowledgeKind?, label: String) -> some View {
        Button {
            kindFilter = kind
        } label: {
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
        }
        .buttonStyle(.plain)
        .glassEffect(kindFilter == kind ? .regular.tint(Brand.inkSolid.opacity(0.85)) : .regular, in: .capsule)
        .foregroundStyle(kindFilter == kind ? .white : Brand.ink)
    }

    private func knowledgeCard(_ item: KnowledgeItem) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Image(systemName: item.kind.symbol)
                        .font(.system(size: 12))
                        .foregroundStyle(Brand.purple)
                    Text(item.title)
                        .font(.system(size: 15, weight: .semibold, design: .serif))
                        .foregroundStyle(Brand.ink)
                    StatusPill(label: item.kind.label, color: Brand.mutedText)
                    Spacer()
                    if let url = item.url, let parsed = URL(string: url) {
                        Link(destination: parsed) { Image(systemName: "arrow.up.right.square").font(.system(size: 11)) }
                    }
                }
                if let description = item.description, !description.isEmpty {
                    Text(description).font(.system(size: 12)).foregroundStyle(Brand.mutedText).lineLimit(2)
                }
                if item.kind == .codeSnippet, let content = item.content, !content.isEmpty {
                    Text(content)
                        .font(.system(size: 11, design: .monospaced))
                        .lineLimit(4)
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Brand.ink.opacity(0.05), in: .rect(cornerRadius: 6))
                }
                MonoLabel(text: "\(state.profile(item.createdBy)?.displayName ?? "unknown") · \(relativeTime(item.updatedAt))\(state.project(item.projectId).map { " · \($0.name)" } ?? "")")
            }
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
        VStack(alignment: .leading, spacing: 14) {
            Text(item == nil ? "Add knowledge" : "Edit knowledge")
                .font(.system(size: 20, weight: .medium, design: .serif))
            Picker("Kind", selection: $kind) {
                ForEach(KnowledgeKind.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
            TextField("Title", text: $title).textFieldStyle(.roundedBorder)
            TextField("Description", text: $description).textFieldStyle(.roundedBorder)
            TextEditor(text: $content)
                .font(.system(size: 12, design: kind == .codeSnippet ? .monospaced : .default))
                .frame(height: 110)
                .scrollContentBackground(.hidden)
                .padding(6)
                .background(Brand.accentField.opacity(0.6), in: .rect(cornerRadius: 8))
            HStack {
                TextField("URL (optional)", text: $url).textFieldStyle(.roundedBorder)
                Picker("Project", selection: $projectId) {
                    Text("No project").tag("")
                    ForEach(state.projects) { Text($0.name).tag($0.id) }
                }
                .frame(width: 200)
            }
            HStack {
                if let item {
                    Button("Delete", role: .destructive) {
                        state.perform { [id = item.id, backend = state.backend] in try await backend?.deleteKnowledgeItem(id: id) }
                        dismiss()
                    }
                }
                Spacer()
                Button("Cancel") { dismiss() }
                Button("Save") { save() }
                    .buttonStyle(.glassProminent).tint(Brand.inkSolid)
                    .disabled(title.isEmpty)
            }
        }
        .padding(22)
        .frame(width: 500)
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

// MARK: - Ideas (lean-canvas cards)

struct IdeasView: View {
    @Environment(AppState.self) private var state
    @State private var editing: Idea?
    @State private var newTitle = ""

    private let columns = [GridItem(.adaptive(minimum: 300), spacing: 14)]

    var body: some View {
        Page(kicker: "Ideas", title: "The idea pipeline") {
            GlassCard(padding: 12) {
                HStack {
                    TextField("Capture an idea…", text: $newTitle)
                        .textFieldStyle(.plain)
                        .onSubmit(capture)
                    Button("Capture", action: capture)
                        .buttonStyle(.glass)
                        .disabled(newTitle.isEmpty)
                }
            }
            if state.ideas.isEmpty {
                EmptyStateView(symbol: "lightbulb", title: "No ideas yet", message: "Capture everything — validation sorts out the winners.")
            } else {
                LazyVGrid(columns: columns, spacing: 14) {
                    ForEach(state.ideas) { idea in
                        Button { editing = idea } label: { ideaCard(idea) }
                            .buttonStyle(.plain)
                    }
                }
            }
        }
        .sheet(item: $editing) { IdeaSheet(idea: $0) }
    }

    private func capture() {
        guard !newTitle.isEmpty else { return }
        state.perform { [newTitle, backend = state.backend] in
            try await backend?.createIdea(title: newTitle, tagline: nil)
        }
        newTitle = ""
    }

    private func verdictColor(_ v: IdeaVerdict?) -> Color {
        switch v {
        case .strong: Brand.green
        case .conditional: .orange
        case .pass: .red
        case nil: Brand.mutedText
        }
    }

    private func ideaCard(_ idea: Idea) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top) {
                    Text(idea.title)
                        .font(.system(size: 15, weight: .semibold, design: .serif))
                        .foregroundStyle(Brand.ink)
                        .lineLimit(2, reservesSpace: true)
                        .multilineTextAlignment(.leading)
                    Spacer()
                    StatusPill(label: idea.status.rawValue, color: idea.status == .validating ? Brand.purple : Brand.mutedText)
                }
                Text(idea.tagline ?? " ")
                    .font(.system(size: 12)).foregroundStyle(Brand.mutedText)
                    .lineLimit(1, reservesSpace: true)
                HStack {
                    if let verdict = idea.verdict {
                        StatusPill(label: verdict.rawValue, color: verdictColor(verdict))
                    }
                    if !idea.scores.isEmpty {
                        let avg = Double(idea.scores.values.reduce(0, +)) / Double(idea.scores.count)
                        MonoLabel(text: String(format: "score %.1f/10", avg))
                    }
                    Spacer()
                    MonoLabel(text: relativeTime(idea.updatedAt))
                }
            }
        }
    }
}

struct IdeaSheet: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss

    let idea: Idea
    @State private var draft: Idea?

    private let scoreKeys = ["problem", "market", "revenue", "moat", "distribution", "build", "team_fit"]

    var body: some View {
        let current = draft ?? idea
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                TextField("Title", text: bind(\.title)).textFieldStyle(.roundedBorder)
                    .font(.system(size: 16, weight: .semibold))
                TextField("Tagline", text: bindOptional(\.tagline)).textFieldStyle(.roundedBorder)
                HStack {
                    Picker("Status", selection: bindStatus) {
                        ForEach(IdeaStatus.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
                    }
                    Picker("Verdict", selection: bindVerdict) {
                        Text("—").tag(nil as IdeaVerdict?)
                        ForEach(IdeaVerdict.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0 as IdeaVerdict?) }
                    }
                }
                field("Problem", \.problem)
                field("Customer", \.customer)
                field("Solution", \.solution)
                field("Revenue model", \.revenueModel)
                field("Stack notes", \.stackNotes)

                MonoLabel(text: "Scores")
                ForEach(scoreKeys, id: \.self) { key in
                    HStack {
                        Text(key.replacingOccurrences(of: "_", with: " ").capitalized)
                            .font(.system(size: 12))
                            .frame(width: 100, alignment: .leading)
                        Slider(value: bindScore(key), in: 0...10, step: 1)
                        Text("\(current.scores[key] ?? 0)")
                            .font(.system(size: 12, design: .monospaced))
                            .frame(width: 22)
                    }
                }

                HStack {
                    Button("Delete", role: .destructive) {
                        state.perform { [id = idea.id, backend = state.backend] in try await backend?.deleteIdea(id: id) }
                        dismiss()
                    }
                    Spacer()
                    Button("Cancel") { dismiss() }
                    Button("Save") {
                        let toSave = draft ?? idea
                        state.perform { [backend = state.backend] in try await backend?.updateIdea(toSave) }
                        dismiss()
                    }
                    .buttonStyle(.glassProminent).tint(Brand.inkSolid)
                }
            }
            .padding(22)
        }
        .frame(width: 520, height: 440)
        .onAppear { draft = idea }
    }

    private func field(_ label: String, _ keyPath: WritableKeyPath<Idea, String?>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            MonoLabel(text: label)
            TextField(label, text: bindOptional(keyPath), axis: .vertical)
                .lineLimit(2...4)
                .textFieldStyle(.roundedBorder)
        }
    }

    private func bind(_ keyPath: WritableKeyPath<Idea, String>) -> Binding<String> {
        Binding(get: { (draft ?? idea)[keyPath: keyPath] },
                set: { draft?[keyPath: keyPath] = $0 })
    }

    private func bindOptional(_ keyPath: WritableKeyPath<Idea, String?>) -> Binding<String> {
        Binding(get: { (draft ?? idea)[keyPath: keyPath] ?? "" },
                set: { draft?[keyPath: keyPath] = $0.isEmpty ? nil : $0 })
    }

    private var bindStatus: Binding<IdeaStatus> {
        Binding(get: { (draft ?? idea).status }, set: { draft?.status = $0 })
    }

    private var bindVerdict: Binding<IdeaVerdict?> {
        Binding(get: { (draft ?? idea).verdict }, set: { draft?.verdict = $0 })
    }

    private func bindScore(_ key: String) -> Binding<Double> {
        Binding(get: { Double((draft ?? idea).scores[key] ?? 0) },
                set: { draft?.scores[key] = Int($0) })
    }
}

// MARK: - Agents (saved AI agents)

struct AgentsView: View {
    @Environment(AppState.self) private var state
    @State private var editing: Agent?
    @State private var creating = false

    private let columns = [GridItem(.adaptive(minimum: 300), spacing: 14)]

    var body: some View {
        Page(kicker: "Agents", title: "Saved AI agents", trailing: AnyView(
            Button { creating = true } label: { Label("New agent", systemImage: "plus") }
                .buttonStyle(.glass)
        )) {
            let active = state.agents.filter { $0.status == .active }
            if active.isEmpty {
                EmptyStateView(symbol: "sparkles", title: "No agents", message: "Save Claude subagents, custom GPTs, and Cursor rules the team reuses.")
            } else {
                LazyVGrid(columns: columns, spacing: 14) {
                    ForEach(active) { agent in
                        Button { editing = agent } label: { agentCard(agent) }
                            .buttonStyle(.plain)
                    }
                }
            }
        }
        .sheet(item: $editing) { AgentSheet(agent: $0) }
        .sheet(isPresented: $creating) { AgentSheet(agent: nil) }
    }

    private func agentCard(_ agent: Agent) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top) {
                    Image(systemName: "sparkles").foregroundStyle(Brand.purple)
                    Text(agent.name)
                        .font(.system(size: 15, weight: .semibold, design: .serif))
                        .foregroundStyle(Brand.ink)
                        .lineLimit(2, reservesSpace: true)
                        .multilineTextAlignment(.leading)
                    Spacer()
                    if let model = agent.model { MonoLabel(text: model) }
                }
                Text(agent.description ?? " ")
                    .font(.system(size: 12)).foregroundStyle(Brand.mutedText)
                    .lineLimit(2, reservesSpace: true)
                    .multilineTextAlignment(.leading)
                HStack(spacing: 4) {
                    ForEach(agent.tools.prefix(4), id: \.self) { tool in
                        StatusPill(label: tool, color: Brand.mutedText)
                    }
                }
                .frame(minHeight: 20, alignment: .leading)
            }
        }
    }
}

struct AgentSheet: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss

    let agent: Agent?
    @State private var name = ""
    @State private var description = ""
    @State private var systemPrompt = ""
    @State private var model = ""
    @State private var toolsText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(agent == nil ? "New agent" : "Edit agent")
                .font(.system(size: 20, weight: .medium, design: .serif))
            TextField("Name", text: $name).textFieldStyle(.roundedBorder)
            TextField("Description", text: $description).textFieldStyle(.roundedBorder)
            VStack(alignment: .leading, spacing: 4) {
                MonoLabel(text: "System prompt")
                TextEditor(text: $systemPrompt)
                    .font(.system(size: 12, design: .monospaced))
                    .frame(height: 130)
                    .scrollContentBackground(.hidden)
                    .padding(6)
                    .background(Brand.accentField.opacity(0.6), in: .rect(cornerRadius: 8))
            }
            HStack {
                TextField("Model (e.g. claude-opus-4-8)", text: $model).textFieldStyle(.roundedBorder)
                TextField("Tools (comma-separated)", text: $toolsText).textFieldStyle(.roundedBorder)
            }
            HStack {
                if let agent {
                    Button("Delete", role: .destructive) {
                        state.perform { [id = agent.id, backend = state.backend] in try await backend?.deleteAgent(id: id) }
                        dismiss()
                    }
                    Button("Archive") {
                        var updated = agent
                        updated.status = .archived
                        state.perform { [backend = state.backend] in try await backend?.updateAgent(updated) }
                        dismiss()
                    }
                }
                Spacer()
                Button("Cancel") { dismiss() }
                Button("Save") { save() }
                    .buttonStyle(.glassProminent).tint(Brand.inkSolid)
                    .disabled(name.isEmpty)
            }
        }
        .padding(22)
        .frame(width: 520)
        .onAppear {
            if let agent {
                name = agent.name
                description = agent.description ?? ""
                systemPrompt = agent.systemPrompt ?? ""
                model = agent.model ?? ""
                toolsText = agent.tools.joined(separator: ", ")
            }
        }
    }

    private func save() {
        let tools = toolsText.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        if var updated = agent {
            updated.name = name
            updated.description = description.isEmpty ? nil : description
            updated.systemPrompt = systemPrompt.isEmpty ? nil : systemPrompt
            updated.model = model.isEmpty ? nil : model
            updated.tools = tools
            state.perform { [backend = state.backend] in try await backend?.updateAgent(updated) }
        } else {
            state.perform { [name, description, systemPrompt, model, tools, backend = state.backend] in
                try await backend?.createAgent(name: name, description: description.isEmpty ? nil : description, systemPrompt: systemPrompt.isEmpty ? nil : systemPrompt, model: model.isEmpty ? nil : model, tools: tools, projectId: nil)
            }
        }
        dismiss()
    }
}
