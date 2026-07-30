import SandboxBrainKit
import Charts
import SwiftUI

// Growth — Phase 2 port of the Mac app's Growth section. Swift Charts works
// as-is on iOS, so the weekly stacked bar chart ports verbatim. The pipeline
// gets the web app's stat tiles (2×2 on phone, adaptive row on iPad) plus the
// Mac's proportional funnel bars underneath.

struct GrowthView: View {
    @Environment(AppState.self) private var state
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    private var isCompact: Bool { horizontalSizeClass == .compact }

    var body: some View {
        Page(kicker: "Growth", title: "Momentum") {
            GlassEffectContainer(spacing: 14) {
                VStack(alignment: .leading, spacing: 14) {
                    pipelineTiles
                    hoursChart
                    funnel
                }
            }
        }
        .navigationTitle("Growth")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
    }

    // MARK: pipeline stages (ports growth.ts — same definitions as Mac + web)

    private struct Stage: Identifiable {
        var id: String { label }
        let label: String
        let value: Int
        let caption: String
        var final = false
    }

    // Captured = all ideas · Validating = ideas validating ·
    // Building = active projects + inprogress tasks ·
    // Shipped = completed projects + tasks done this month.
    private var stages: [Stage] {
        let cal = Calendar.current
        let monthStart = cal.date(from: cal.dateComponents([.year, .month], from: Date()))!
        let captured = state.ideas.count
        let validating = state.ideas.filter { $0.status == .validating }.count
        let building = state.projects.filter { $0.status == .active }.count
            + state.tasks.filter { $0.status == .inprogress }.count
        let shipped = state.projects.filter { $0.status == .completed }.count
            + state.tasks.filter { $0.status == .done && parseISO($0.updatedAt) >= monthStart }.count
        return [
            Stage(label: "Captured", value: captured, caption: "ideas in the hopper"),
            Stage(label: "Validating", value: validating, caption: "ideas being tested"),
            Stage(label: "Building", value: building, caption: "active projects + tickets"),
            Stage(label: "Shipped", value: shipped, caption: "done this month", final: true),
        ]
    }

    // MARK: stat tiles — 2×2 on phone, adaptive row on iPad (HomeView idiom)

    private var tileColumns: [GridItem] {
        isCompact
            ? [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)]
            : [GridItem(.adaptive(minimum: 160), spacing: 14)]
    }

    private var pipelineTiles: some View {
        LazyVGrid(columns: tileColumns, spacing: 14) {
            ForEach(stages) { stage in
                tile(stage)
            }
        }
    }

    @ViewBuilder
    private func tile(_ stage: Stage) -> some View {
        if stage.final {
            // "Shipped" is the payoff tile — solid ink in both modes,
            // matching the web app's pipeline grid.
            VStack(alignment: .leading, spacing: 4) {
                Text(stage.label.uppercased())
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .tracking(1.2)
                    .foregroundStyle(.white.opacity(0.55))
                Text("\(stage.value)")
                    .font(.system(size: 24, weight: .medium, design: .serif))
                    .foregroundStyle(.white)
                Text(stage.caption)
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.7))
            }
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(Brand.inkSolid, in: .rect(cornerRadius: 16))
        } else {
            GlassCard(padding: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    MonoLabel(text: stage.label)
                    Text("\(stage.value)")
                        .font(.system(size: 24, weight: .medium, design: .serif))
                        .foregroundStyle(Brand.ink)
                    Text(stage.caption)
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.mutedText)
                }
            }
        }
    }

    // MARK: weekly hours chart (Swift Charts — identical to Mac)

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

    // MARK: funnel bars (proportional view of the same stages)

    private var funnel: some View {
        let stages = self.stages
        let maxCount = max(stages.map(\.value).max() ?? 1, 1)

        return GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                MonoLabel(text: "Idea → shipped pipeline")
                ForEach(stages) { stage in
                    HStack(spacing: 10) {
                        MonoLabel(text: stage.label)
                            .frame(width: 80, alignment: .leading)
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Brand.accentField)
                                Capsule().fill(Brand.ink)
                                    .frame(width: max(6, geo.size.width * CGFloat(stage.value) / CGFloat(maxCount)))
                            }
                        }
                        .frame(height: 10)
                        Text("\(stage.value)")
                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                            .frame(width: 26, alignment: .trailing)
                    }
                    .frame(height: 18)
                }
            }
        }
    }
}
