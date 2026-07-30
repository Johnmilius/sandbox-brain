import SandboxBrainKit
import SwiftUI

// Ideas — port of the Mac app's idea pipeline (BrainIdeasAgentsView, Ideas
// portion): quick-capture bar, lean-canvas cards (1 column on phone), and a
// Form-based detail/edit sheet with status, verdict, canvas fields, and scores.

struct IdeasView: View {
    @Environment(AppState.self) private var state
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var editing: Idea?
    @State private var newTitle = ""

    private var columns: [GridItem] {
        horizontalSizeClass == .compact
            ? [GridItem(.flexible())]
            : [GridItem(.adaptive(minimum: 300), spacing: 14)]
    }

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
        .toolbarBackground(.hidden, for: .navigationBar)
        .navigationTitle("Ideas")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $editing) {
            IdeaSheet(idea: $0)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .task { await applyVerificationHook() }
    }

    /// Dev/verification hook (same SIMCTL_CHILD_SB_* pattern as DemoDriver):
    /// SB_OPEN_IDEA=1 opens the first idea's detail/edit sheet for simulator
    /// screenshots. No-op outside that environment.
    private func applyVerificationHook() async {
        guard ProcessInfo.processInfo.environment["SB_OPEN_IDEA"] == "1" else { return }
        for _ in 0..<40 where state.ideas.isEmpty {
            try? await Task.sleep(for: .milliseconds(100))
        }
        editing = state.ideas.first
    }

    private func capture() {
        guard !newTitle.isEmpty else { return }
        state.perform { [newTitle, backend = state.backend] in
            try await backend?.createIdea(title: newTitle, tagline: nil)
        }
        newTitle = ""
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

    private func verdictColor(_ v: IdeaVerdict?) -> Color {
        switch v {
        case .strong: Brand.green
        case .conditional: .orange
        case .pass: .red
        case nil: Brand.mutedText
        }
    }
}

// Detail/edit sheet — the Mac sheet's fixed-size VStack re-shaped as a
// grouped Form so it scrolls inside its presentation detent.
struct IdeaSheet: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss

    let idea: Idea
    @State private var title = ""
    @State private var tagline = ""
    @State private var problem = ""
    @State private var customer = ""
    @State private var solution = ""
    @State private var revenueModel = ""
    @State private var stackNotes = ""
    @State private var status: IdeaStatus = .draft
    @State private var verdict: IdeaVerdict?
    @State private var scores: [String: Int] = [:]

    private let scoreKeys = ["problem", "market", "revenue", "moat", "distribution", "build", "team_fit"]

    var body: some View {
        NavigationStack {
            Form {
                SwiftUI.Section {
                    TextField("Title", text: $title)
                    TextField("Tagline", text: $tagline)
                    Picker("Status", selection: $status) {
                        ForEach(IdeaStatus.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
                    }
                    Picker("Verdict", selection: $verdict) {
                        Text("—").tag(nil as IdeaVerdict?)
                        ForEach(IdeaVerdict.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0 as IdeaVerdict?) }
                    }
                }

                SwiftUI.Section("Lean canvas") {
                    canvasField("Problem", $problem)
                    canvasField("Customer", $customer)
                    canvasField("Solution", $solution)
                    canvasField("Revenue model", $revenueModel)
                    canvasField("Stack notes", $stackNotes)
                }

                SwiftUI.Section("Scores") {
                    ForEach(scoreKeys, id: \.self) { key in
                        HStack {
                            Text(key.replacingOccurrences(of: "_", with: " ").capitalized)
                                .font(.system(size: 13))
                                .frame(width: 96, alignment: .leading)
                            Slider(value: bindScore(key), in: 0...10, step: 1)
                            Text("\(scores[key] ?? 0)")
                                .font(.system(size: 13, design: .monospaced))
                                .frame(width: 22)
                        }
                    }
                }

                SwiftUI.Section {
                    Button("Delete idea", role: .destructive) {
                        state.perform { [id = idea.id, backend = state.backend] in try await backend?.deleteIdea(id: id) }
                        dismiss()
                    }
                }
            }
            .navigationTitle("Idea")
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
                title = idea.title
                tagline = idea.tagline ?? ""
                problem = idea.problem ?? ""
                customer = idea.customer ?? ""
                solution = idea.solution ?? ""
                revenueModel = idea.revenueModel ?? ""
                stackNotes = idea.stackNotes ?? ""
                status = idea.status
                verdict = idea.verdict
                scores = idea.scores
            }
        }
    }

    private func canvasField(_ label: String, _ text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            MonoLabel(text: label)
            TextField(label, text: text, axis: .vertical)
                .lineLimit(2...4)
        }
    }

    private func bindScore(_ key: String) -> Binding<Double> {
        Binding(get: { Double(scores[key] ?? 0) },
                set: { scores[key] = Int($0) })
    }

    private func save() {
        var updated = idea
        updated.title = title
        updated.tagline = tagline.isEmpty ? nil : tagline
        updated.problem = problem.isEmpty ? nil : problem
        updated.customer = customer.isEmpty ? nil : customer
        updated.solution = solution.isEmpty ? nil : solution
        updated.revenueModel = revenueModel.isEmpty ? nil : revenueModel
        updated.stackNotes = stackNotes.isEmpty ? nil : stackNotes
        updated.status = status
        updated.verdict = verdict
        updated.scores = scores
        state.perform { [backend = state.backend] in try await backend?.updateIdea(updated) }
        dismiss()
    }
}
