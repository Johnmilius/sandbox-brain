import SandboxBrainKit
import SwiftUI

// Academy — Phase 2 port of the Mac app's Academy section (modules with
// per-person step progress + outcome self-assessments). Phone-first: one
// column, module header stacks its pills under the title, outcome cards
// stack vertically instead of the Mac's wide single row.

struct AcademyView: View {
    @Environment(AppState.self) private var state
    @State private var expandedModule: String?

    var body: some View {
        Page(kicker: "Academy", title: "The curriculum") {
            if state.modules.isEmpty {
                EmptyStateView(symbol: "graduationcap", title: "No modules", message: "Modules are seeded from the Sandbox bootcamp curriculum (npm run seed:academy on the web side).")
            }
            ForEach(state.modules) { module in
                moduleCard(module)
            }
            if !state.outcomes.isEmpty {
                MonoLabel(text: "Learning outcomes")
                ForEach(state.outcomes) { outcome in
                    outcomeCard(outcome)
                }
            }
        }
        .navigationTitle("Academy")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
    }

    private func moduleSteps(_ moduleId: String) -> [AcademyStep] {
        state.steps.filter { $0.moduleId == moduleId }.sorted { $0.stepNo < $1.stepNo }
    }

    private func isDone(_ stepId: String) -> Bool {
        state.progress.contains { $0.stepId == stepId && $0.userId == state.currentUserId }
    }

    private func moduleCard(_ module: AcademyModule) -> some View {
        let steps = moduleSteps(module.id)
        let doneCount = steps.filter { isDone($0.id) }.count
        return GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                Button {
                    withAnimation(.snappy) {
                        expandedModule = expandedModule == module.id ? nil : module.id
                    }
                } label: {
                    HStack(alignment: .top, spacing: 10) {
                        ZStack {
                            Circle().stroke(Brand.accentField, lineWidth: 4)
                            Circle()
                                .trim(from: 0, to: steps.isEmpty ? 0 : CGFloat(doneCount) / CGFloat(steps.count))
                                .stroke(Brand.purple, style: .init(lineWidth: 4, lineCap: .round))
                                .rotationEffect(.degrees(-90))
                        }
                        .frame(width: 28, height: 28)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(module.title)
                                .font(.system(size: 15, weight: .semibold, design: .serif))
                                .foregroundStyle(Brand.ink)
                                .multilineTextAlignment(.leading)
                            if let description = module.description {
                                Text(description).font(.system(size: 11.5)).foregroundStyle(Brand.mutedText).lineLimit(1)
                            }
                            // Phone: pills drop below the title instead of the
                            // Mac's wide trailing cluster.
                            HStack(spacing: 6) {
                                StatusPill(label: module.kind, color: Brand.purple)
                                Text("\(doneCount)/\(steps.count)")
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundStyle(Brand.mutedText)
                            }
                        }
                        Spacer()
                        Image(systemName: expandedModule == module.id ? "chevron.up" : "chevron.down")
                            .font(.system(size: 10))
                            .foregroundStyle(Brand.mutedText)
                            .padding(.top, 8)
                    }
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)

                if expandedModule == module.id {
                    ForEach(steps) { step in
                        stepRow(step)
                    }
                }
            }
        }
    }

    private func stepRow(_ step: AcademyStep) -> some View {
        let done = isDone(step.id)
        return HStack(alignment: .top, spacing: 10) {
            Button {
                state.perform { [id = step.id, done, backend = state.backend] in
                    try await backend?.setStep(stepId: id, complete: !done)
                }
            } label: {
                Image(systemName: done ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(done ? Brand.green : Brand.mutedText)
            }
            .buttonStyle(.plain)
            VStack(alignment: .leading, spacing: 4) {
                Text("\(step.stepNo). \(step.title)")
                    .font(.system(size: 12.5, weight: .medium))
                    .strikethrough(done, color: Brand.mutedText)
                    .foregroundStyle(done ? Brand.mutedText : Brand.ink)
                HStack(spacing: 6) {
                    StatusPill(label: step.stepType.replacingOccurrences(of: "_", with: " "), color: Brand.mutedText)
                    // Teammates' completion dots
                    ForEach(state.progress.filter { $0.stepId == step.id && $0.userId != state.currentUserId }) { p in
                        AvatarView(profile: state.profile(p.userId), size: 14,
                                   color: Brand.identity(p.userId, profiles: state.profiles))
                    }
                }
                if !step.promptText.isEmpty {
                    HStack(alignment: .top, spacing: 6) {
                        Text(step.promptText)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(Brand.mutedText)
                            .lineLimit(2)
                        Button {
                            UIPasteboard.general.string = step.promptText
                        } label: {
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 9))
                                .frame(width: 22, height: 22)
                                .contentShape(.rect)
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(Brand.mutedText)
                    }
                }
            }
            Spacer()
        }
        .padding(.leading, 24)
    }

    private func outcomeCard(_ outcome: AcademyOutcome) -> some View {
        let mine = state.assessments.first { $0.outcomeId == outcome.id && $0.userId == state.currentUserId }
        let others = state.assessments.filter { $0.outcomeId == outcome.id && $0.userId != state.currentUserId }
        let labels = ["Novice", "Developing", "Strong", "Advanced"]
        return FlatCard(padding: 12) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(outcome.name)
                            .font(.system(size: 13.5, weight: .medium))
                            .foregroundStyle(Brand.ink)
                        if let description = outcome.description {
                            Text(description).font(.system(size: 11)).foregroundStyle(Brand.mutedText).lineLimit(2)
                        }
                    }
                    Spacer()
                    // Phone: menu picker without the Mac's fixed 150pt width.
                    Picker("", selection: Binding(
                        get: { mine?.rating ?? 0 },
                        set: { newRating in
                            guard newRating > 0 else { return }
                            state.perform { [id = outcome.id, backend = state.backend] in
                                try await backend?.upsertAssessment(outcomeId: id, rating: newRating, confidence: nil, note: nil)
                            }
                        }
                    )) {
                        Text("Rate yourself…").tag(0)
                        ForEach(1...4, id: \.self) { r in Text(labels[r - 1]).tag(r) }
                    }
                    .pickerStyle(.menu)
                    .tint(Brand.ink)
                    .labelsHidden()
                }
                if !others.isEmpty {
                    // Teammates' ratings on their own row so long outcome
                    // names never crush them.
                    HStack(spacing: 10) {
                        ForEach(others) { a in
                            HStack(spacing: 3) {
                                AvatarView(profile: state.profile(a.userId), size: 16,
                                           color: Brand.identity(a.userId, profiles: state.profiles))
                                MonoLabel(text: labels[min(max(a.rating - 1, 0), 3)])
                            }
                        }
                    }
                }
            }
        }
    }
}
