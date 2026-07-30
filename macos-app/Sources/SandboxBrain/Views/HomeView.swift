import SandboxBrainKit
import SwiftUI

// Home digest — greeting, running timers, 7-day activity, latest team feed.
// Ports src/app/page.tsx + src/lib/home-digest.ts.
//
// Layout: a dashboard, so the page fills the window and the feed scrolls inside
// it rather than the whole page growing past the viewport. Counts live in a thin
// inline strip under the greeting instead of a row of metric cards — they're
// context for the feed, not the reason you opened the app, and four equal-weight
// tiles gave the eye nothing to rank.

struct HomeView: View {
    @Environment(AppState.self) private var state
    var openSection: (Section) -> Void = { _ in }
    @State private var mineOnly = false

    /// Side-by-side needs room for a readable feed column plus the rail; below
    /// that the rail stacks above and the page scrolls. Keyed on real width, not
    /// a size class.
    private let feedMinWidth: CGFloat = 420
    private let railWidth: CGFloat = 300

    var body: some View {
        Page(kicker: monoDate(), title: "\(greeting()), \(firstName)",
             fills: true, maxContentWidth: 1240) {
            VStack(alignment: .leading, spacing: 22) {
                countStrip
                runningNow
                // Two columns while there's room for a readable feed beside the
                // rail; stacked below that. Keyed on the width actually offered,
                // so it re-flows as the window is dragged narrower.
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .top, spacing: 18) {
                        feedCard.frame(minWidth: feedMinWidth, maxHeight: .infinity)
                        rail.frame(width: railWidth)
                    }
                    VStack(alignment: .leading, spacing: 18) {
                        rail
                        feedCard
                    }
                }
                .frame(maxHeight: .infinity)
            }
        }
    }

    private var firstName: String {
        state.profile(state.currentUserId)?.displayName.split(separator: " ").first.map(String.init) ?? "there"
    }

    // MARK: counts

    /// Three counts on one hairline-separated line. Dropped "updates in 24h":
    /// it counted a list that was already truncated, so it was never the real
    /// number, and it earned a quarter of the header for it.
    private var countStrip: some View {
        HStack(spacing: 0) {
            count(value: "\(state.projects.filter { $0.status == .active }.count)",
                  label: "active projects", section: .projects)
            divider
            count(value: formatHours(ms: weekMs), label: "logged this week", section: .time)
            divider
            count(value: "\(state.tasks.filter { $0.status == .inprogress }.count)",
                  label: "tasks in progress", section: .tasks)
            Spacer(minLength: 0)
        }
    }

    private var divider: some View {
        Rectangle()
            .fill(Brand.border)
            .frame(width: 1, height: 22)
            .padding(.horizontal, 18)
    }

    private func count(value: String, label: String, section: Section) -> some View {
        Button { openSection(section) } label: {
            HStack(alignment: .firstTextBaseline, spacing: 7) {
                Text(value)
                    .font(.system(size: 19, weight: .medium, design: .serif))
                    .foregroundStyle(Brand.ink)
                Text(label)
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.mutedText)
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }

    private var weekMs: Double {
        let start = weekStartLocal()
        return state.entries
            .filter { parseISO($0.startedAt) >= start }
            .reduce(0) { $0 + $1.durationMs() }
    }

    // MARK: running timers

    @ViewBuilder
    private var runningNow: some View {
        let running = state.runningEntries
        if !running.isEmpty {
            GlassCard(padding: 14) {
                VStack(alignment: .leading, spacing: 9) {
                    ForEach(running) { entry in
                        HStack(spacing: 9) {
                            Circle().fill(Brand.green).frame(width: 7, height: 7)
                            AvatarView(profile: state.profile(entry.userId), size: 22,
                                       color: Brand.identity(entry.userId, profiles: state.profiles))
                            Text(state.profile(entry.userId)?.displayName ?? "Someone")
                                .font(.system(size: 13, weight: .medium))
                            Text("on \(state.project(entry.projectId)?.name ?? "a project")")
                                .font(.system(size: 13))
                                .foregroundStyle(Brand.mutedText)
                            Spacer()
                            Text("started \(relativeTime(entry.startedAt))")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundStyle(Brand.mutedText)
                        }
                    }
                }
            }
            .glassEffect(.regular.tint(Brand.green.opacity(0.10)), in: .rect(cornerRadius: 16))
        }
    }

    // MARK: activity feed (union of notes / prompts / time / ideas, latest first)

    private struct FeedItem: Identifiable {
        let id: String
        let actorId: String
        let verb: String
        let object: String
        let context: String
        let kind: Section
        let at: String
    }

    private var feed: [FeedItem] {
        var items: [FeedItem] = []
        items += state.notes.map {
            FeedItem(id: "note-\($0.id)", actorId: $0.authorId, verb: $0.createdAt == $0.updatedAt ? "wrote" : "updated", object: $0.title, context: "notes", kind: .notes, at: $0.updatedAt)
        }
        items += state.prompts.map {
            FeedItem(id: "prompt-\($0.id)", actorId: $0.userId, verb: "saved", object: $0.title, context: $0.aiTool ?? "prompts", kind: .prompts, at: $0.updatedAt)
        }
        items += state.entries.filter { !$0.isRunning }.map {
            FeedItem(id: "time-\($0.id)", actorId: $0.userId, verb: "logged \(formatSpan(ms: $0.durationMs()))", object: state.project($0.projectId)?.name ?? "a project", context: "time", kind: .time, at: $0.endedAt ?? $0.startedAt)
        }
        items += state.ideas.map {
            FeedItem(id: "idea-\($0.id)", actorId: $0.createdBy, verb: "captured", object: $0.title, context: "ideas", kind: .ideas, at: $0.updatedAt)
        }
        let filtered = mineOnly ? items.filter { $0.actorId == state.currentUserId } : items
        // The feed scrolls in place now, so it isn't capped at a screenful.
        return filtered.sorted { parseISO($0.at) > parseISO($1.at) }.prefix(40).map { $0 }
    }

    /// Feed split into day runs, newest first. Day headings give the list a beat
    /// and make staleness legible — three "15d ago" rows in a row read as a bug
    /// until you can see they all belong to one old day.
    private var feedByDay: [(label: String, items: [FeedItem])] {
        let calendar = Calendar.current
        var order: [Date] = []
        var groups: [Date: [FeedItem]] = [:]
        for item in feed {
            let day = calendar.startOfDay(for: parseISO(item.at))
            if groups[day] == nil { order.append(day) }
            groups[day, default: []].append(item)
        }
        return order.map { (dayLabel($0, calendar: calendar), groups[$0] ?? []) }
    }

    private func dayLabel(_ day: Date, calendar: Calendar) -> String {
        if calendar.isDateInToday(day) { return "Today" }
        if calendar.isDateInYesterday(day) { return "Yesterday" }
        return day.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }

    private var feedCard: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    MonoLabel(text: "Latest")
                    Spacer()
                    Picker("", selection: $mineOnly) {
                        Text("Team").tag(false)
                        Text("Mine").tag(true)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 140)
                }
                .padding(.bottom, 14)

                if feed.isEmpty {
                    EmptyStateView(symbol: "sparkles", title: "All quiet",
                                   message: "Team activity shows up here.")
                        .frame(maxHeight: .infinity)
                } else {
                    // No inner ScrollView: the page owns scrolling, so a long
                    // feed just makes the page longer. Nesting scroll views here
                    // would trap the wheel over the card and fight the page.
                    VStack(alignment: .leading, spacing: 16) {
                        ForEach(feedByDay, id: \.label) { group in
                            VStack(alignment: .leading, spacing: 7) {
                                MonoLabel(text: group.label)
                                ForEach(group.items) { feedRow($0) }
                            }
                        }
                    }
                    Spacer(minLength: 0)
                }
            }
        }
    }

    private func feedRow(_ item: FeedItem) -> some View {
        Button { openSection(item.kind) } label: {
            HStack(spacing: 9) {
                AvatarView(profile: state.profile(item.actorId), size: 22,
                           color: Brand.identity(item.actorId, profiles: state.profiles))
                Group {
                    Text(state.profile(item.actorId)?.displayName.split(separator: " ").first.map(String.init) ?? "Someone")
                        .fontWeight(.medium)
                    + Text(" \(item.verb) ")
                        .foregroundStyle(Brand.mutedText)
                    + Text(item.object)
                        .fontWeight(.medium)
                }
                .font(.system(size: 12.5))
                .lineLimit(1)
                Spacer(minLength: 10)
                MonoLabel(text: item.context)
                Text(relativeTime(item.at))
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Brand.mutedText)
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }

    // MARK: rail — this week's shape, then where the hours went

    private var rail: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 20) {
                weekBars
                if !projectTotals.isEmpty {
                    Rectangle().fill(Brand.border).frame(height: 1)
                    projectBreakdown
                }
            }
        }
    }

    /// One day column: `dayBuckets()` hands back an anonymous tuple, so this
    /// names the shape the bar chart actually draws.
    private struct DayLoad: Identifiable {
        let id: Int
        let letter: String
        let isToday: Bool
        let ms: Double
    }

    private var dayTotals: [DayLoad] {
        dayBuckets().enumerated().map { index, bucket in
            let ms = state.entries
                .filter { parseISO($0.startedAt) >= bucket.start && parseISO($0.startedAt) < bucket.end }
                .reduce(0.0) { $0 + $1.durationMs() }
            return DayLoad(id: index, letter: bucket.letter, isToday: bucket.isToday, ms: ms)
        }
    }

    private var weekBars: some View {
        let totals = dayTotals
        let maxMs = max(totals.map(\.ms).max() ?? 1, 1)
        let sum = totals.reduce(0.0) { $0 + $1.ms }
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                MonoLabel(text: "Last 7 days")
                Spacer()
                Text(formatHours(ms: sum))
                    .font(.system(size: 13, weight: .medium, design: .serif))
                    .foregroundStyle(Brand.ink)
            }
            HStack(alignment: .bottom, spacing: 7) {
                ForEach(totals) { entry in
                    VStack(spacing: 6) {
                        // No track behind the bars: a full-height well turns each
                        // column into a percentage gauge, which is the wrong read
                        // for a bar chart. Clear space reserves the height so the
                        // day letters stay aligned, and a day with no time gets a
                        // baseline rule — unmistakably nothing, rather than a
                        // small bar implying "a little".
                        ZStack(alignment: .bottom) {
                            Color.clear
                            if entry.ms > 0 {
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(entry.isToday ? Brand.purple : Brand.ink.opacity(0.75))
                                    .frame(height: max(5, 76 * entry.ms / maxMs))
                            } else {
                                RoundedRectangle(cornerRadius: 1)
                                    .fill(Brand.border)
                                    .frame(height: 2)
                            }
                        }
                        .frame(height: 76)
                        Text(entry.letter)
                            .font(.system(size: 9, weight: entry.isToday ? .bold : .regular, design: .monospaced))
                            .foregroundStyle(entry.isToday ? Brand.purple : Brand.mutedText)
                    }
                }
            }
        }
    }

    /// Projects by hours this week — gives the rail real content down its length
    /// instead of one short card stranding an empty column.
    private var projectTotals: [(name: String, ms: Double)] {
        let start = weekStartLocal()
        var byProject: [String: Double] = [:]
        for entry in state.entries where parseISO(entry.startedAt) >= start {
            let name = state.project(entry.projectId)?.name ?? "Unassigned"
            byProject[name, default: 0] += entry.durationMs()
        }
        return byProject
            .filter { $0.value > 0 }
            .sorted { $0.value > $1.value || ($0.value == $1.value && $0.key < $1.key) }
            .prefix(5)
            .map { (name: $0.key, ms: $0.value) }
    }

    private var projectBreakdown: some View {
        let totals = projectTotals
        let maxMs = max(totals.map(\.ms).max() ?? 1, 1)
        return VStack(alignment: .leading, spacing: 11) {
            MonoLabel(text: "Where it went")
            ForEach(totals, id: \.name) { project in
                Button { openSection(.time) } label: {
                    VStack(alignment: .leading, spacing: 5) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(project.name)
                                .font(.system(size: 12.5))
                                .foregroundStyle(Brand.ink)
                                .lineLimit(1)
                            Spacer(minLength: 8)
                            Text(formatSpan(ms: project.ms))
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundStyle(Brand.mutedText)
                        }
                        ZStack(alignment: .leading) {
                            Capsule().fill(Brand.accentField).frame(height: 5)
                            Capsule()
                                .fill(Brand.purple.opacity(0.85))
                                .frame(width: nil, height: 5)
                                .scaleEffect(x: max(0.02, project.ms / maxMs), y: 1, anchor: .leading)
                        }
                    }
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
            }
        }
    }
}
