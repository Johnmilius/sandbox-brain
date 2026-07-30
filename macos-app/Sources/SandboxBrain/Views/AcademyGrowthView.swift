import SandboxBrainKit
import Charts
import SwiftUI

// MARK: - Academy (modules, per-person step progress, outcome self-assessments)

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
                    HStack(spacing: 10) {
                        ZStack {
                            Circle().stroke(Brand.accentField, lineWidth: 4)
                            Circle()
                                .trim(from: 0, to: steps.isEmpty ? 0 : CGFloat(doneCount) / CGFloat(steps.count))
                                .stroke(Brand.purple, style: .init(lineWidth: 4, lineCap: .round))
                                .rotationEffect(.degrees(-90))
                        }
                        .frame(width: 28, height: 28)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(module.title)
                                .font(.system(size: 15, weight: .semibold, design: .serif))
                                .foregroundStyle(Brand.ink)
                            if let description = module.description {
                                Text(description).font(.system(size: 11.5)).foregroundStyle(Brand.mutedText).lineLimit(1)
                            }
                        }
                        Spacer()
                        StatusPill(label: module.kind, color: Brand.purple)
                        Text("\(doneCount)/\(steps.count)")
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(Brand.mutedText)
                        Image(systemName: expandedModule == module.id ? "chevron.up" : "chevron.down")
                            .font(.system(size: 10))
                            .foregroundStyle(Brand.mutedText)
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
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text("\(step.stepNo). \(step.title)")
                        .font(.system(size: 12.5, weight: .medium))
                        .strikethrough(done, color: Brand.mutedText)
                        .foregroundStyle(done ? Brand.mutedText : Brand.ink)
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
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(step.promptText, forType: .string)
                        } label: { Image(systemName: "doc.on.doc").font(.system(size: 9)) }
                            .buttonStyle(.plain)
                            .foregroundStyle(Brand.mutedText)
                            .help("Copy prompt")
                    }
                }
            }
            Spacer()
        }
        .padding(.leading, 38)
    }

    private func outcomeCard(_ outcome: AcademyOutcome) -> some View {
        let mine = state.assessments.first { $0.outcomeId == outcome.id && $0.userId == state.currentUserId }
        let labels = ["Novice", "Developing", "Strong", "Advanced"]
        return FlatCard(padding: 12) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(outcome.name)
                        .font(.system(size: 13.5, weight: .medium))
                        .foregroundStyle(Brand.ink)
                    if let description = outcome.description {
                        Text(description).font(.system(size: 11)).foregroundStyle(Brand.mutedText).lineLimit(1)
                    }
                }
                Spacer()
                // Teammates' ratings
                ForEach(state.assessments.filter { $0.outcomeId == outcome.id && $0.userId != state.currentUserId }) { a in
                    HStack(spacing: 3) {
                        AvatarView(profile: state.profile(a.userId), size: 16,
                                   color: Brand.identity(a.userId, profiles: state.profiles))
                        MonoLabel(text: labels[min(max(a.rating - 1, 0), 3)])
                    }
                }
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
                .frame(width: 150)
            }
        }
    }
}

// MARK: - Growth (weekly hours chart + pipeline funnel)

struct GrowthView: View {
    @Environment(AppState.self) private var state

    var body: some View {
        Page(kicker: "Growth", title: "Momentum") {
            GlassEffectContainer(spacing: 14) {
                VStack(alignment: .leading, spacing: 14) {
                    hoursChart
                    funnel
                }
            }
        }
    }

    private struct WeekSlice: Identifiable {
        let id = UUID()
        let label: String
        let person: String
        let personId: String
        let hours: Double
    }

    private var weekSlices: [WeekSlice] {
        let cal = Calendar.current
        let thisWeek = weekStartLocal()
        var slices: [WeekSlice] = []
        for i in stride(from: 7, through: 0, by: -1) {
            let start = cal.date(byAdding: .day, value: -i * 7, to: thisWeek)!
            let end = cal.date(byAdding: .day, value: 7, to: start)!
            let f = DateFormatter()
            f.dateFormat = "MMM d"
            let label = f.string(from: start).uppercased()
            let weekEntries = state.entries.filter {
                let s = parseISO($0.startedAt)
                return s >= start && s < end
            }
            for profile in state.profiles {
                let ms = weekEntries.filter { $0.userId == profile.id }.reduce(0.0) { $0 + $1.durationMs() }
                slices.append(WeekSlice(label: label, person: profile.displayName.split(separator: " ").first.map(String.init) ?? "?", personId: profile.id, hours: ms / 3_600_000))
            }
        }
        return slices
    }

    private var hoursChart: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                MonoLabel(text: "Hours per week · last 8 weeks")
                Chart(weekSlices) { slice in
                    BarMark(
                        x: .value("Week", slice.label),
                        y: .value("Hours", slice.hours)
                    )
                    .foregroundStyle(by: .value("Person", slice.person))
                    .cornerRadius(3)
                }
                .chartForegroundStyleScale(range: state.profiles.map { Brand.identity($0.id, profiles: state.profiles) })
                .frame(height: 220)
            }
        }
    }

    private var funnel: some View {
        // Captured = all ideas · Validating = ideas validating ·
        // Building = active projects + inprogress tasks ·
        // Shipped = completed projects + tasks done this month (ports growth.ts).
        let cal = Calendar.current
        let monthStart = cal.date(from: cal.dateComponents([.year, .month], from: Date()))!
        let captured = state.ideas.count
        let validating = state.ideas.filter { $0.status == .validating }.count
        let building = state.projects.filter { $0.status == .active }.count
            + state.tasks.filter { $0.status == .inprogress }.count
        let shipped = state.projects.filter { $0.status == .completed }.count
            + state.tasks.filter { $0.status == .done && parseISO($0.updatedAt) >= monthStart }.count

        let stages: [(String, Int)] = [("Captured", captured), ("Validating", validating), ("Building", building), ("Shipped", shipped)]
        let maxCount = max(stages.map(\.1).max() ?? 1, 1)

        return GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                MonoLabel(text: "Idea → shipped pipeline")
                ForEach(stages, id: \.0) { stage, count in
                    HStack(spacing: 10) {
                        MonoLabel(text: stage)
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Brand.accentField)
                                Capsule().fill(Brand.ink)
                                    .frame(width: max(6, geo.size.width * CGFloat(count) / CGFloat(maxCount)))
                            }
                        }
                        .frame(height: 10)
                        Text("\(count)")
                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                            .frame(width: 26, alignment: .trailing)
                    }
                    .frame(height: 18)
                }
            }
        }
    }
}
