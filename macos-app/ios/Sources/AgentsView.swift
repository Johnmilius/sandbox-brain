import SandboxBrainKit
import SwiftUI

// Agents — Phase 2 port of the Mac app's Agents section
// (BrainIdeasAgentsView.swift). Active-agent cards (grid collapses to one
// column on the phone) plus the create/edit sheet as a Form with detents;
// archive and delete carried over from the Mac sheet.

struct AgentsView: View {
    @Environment(AppState.self) private var state
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var editing: Agent?
    @State private var creating = false

    private var columns: [GridItem] {
        horizontalSizeClass == .compact
            ? [GridItem(.flexible())]
            : [GridItem(.adaptive(minimum: 300), spacing: 14)]
    }

    var body: some View {
        Page(kicker: "Agents", title: "Saved AI agents", trailing: AnyView(
            Button { creating = true } label: { Label("New", systemImage: "plus") }
                .buttonStyle(.glass)
        )) {
            let active = state.agents.filter { $0.status == .active }
            if active.isEmpty {
                EmptyStateView(symbol: "sparkles", title: "No agents",
                               message: "Save Claude subagents, custom GPTs, and Cursor rules the team reuses.")
            } else {
                LazyVGrid(columns: columns, spacing: 14) {
                    ForEach(active) { agent in
                        Button { editing = agent } label: { agentCard(agent) }
                            .buttonStyle(.plain)
                    }
                }
            }
        }
        .toolbarBackground(.hidden, for: .navigationBar)
        .navigationTitle("Agents")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $editing) {
            AgentSheet(agent: $0)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $creating) {
            AgentSheet(agent: nil)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
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
            .contentShape(.rect)
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
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                TextField("Description", text: $description, axis: .vertical)
                    .lineLimit(2...4)
                SwiftUI.Section("System prompt") {
                    TextEditor(text: $systemPrompt)
                        .font(.system(size: 13, design: .monospaced))
                        .frame(minHeight: 130)
                }
                SwiftUI.Section {
                    TextField("Model (e.g. claude-opus-4-8)", text: $model)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Tools (comma-separated)", text: $toolsText)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                if let agent {
                    SwiftUI.Section {
                        Button("Archive agent") {
                            var updated = agent
                            updated.status = .archived
                            state.perform { [backend = state.backend] in try await backend?.updateAgent(updated) }
                            dismiss()
                        }
                        Button("Delete agent", role: .destructive) {
                            state.perform { [id = agent.id, backend = state.backend] in
                                try await backend?.deleteAgent(id: id)
                            }
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle(agent == nil ? "New agent" : "Edit agent")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(name.isEmpty)
                }
            }
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
