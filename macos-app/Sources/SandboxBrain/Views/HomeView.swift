import SandboxBrainKit
import SwiftUI

// Home digest — greeting, running timers, 7-day activity, latest team feed.
// Ports src/app/page.tsx + src/lib/home-digest.ts.

struct HomeView: View {
    @Environment(AppState.self) private var state
    var openSection: (Section) -> Void = { _ in }
    @State private var mineOnly = false

    var body: some View {
        Page(kicker: monoDate(), title: "\(greeting()), \(firstName)") {
            GlassEffectContainer(spacing: 14) {
                VStack(alignment: .leading, spacing: 14) {
                    statsRow
                    runningNow
                    ViewThatFits(in: .horizontal) {
                        HStack(alignment: .top, spacing: 14) {
                            feedCard
                            weekCard.frame(width: 300)
                        }
                        VStack(alignment: .leading, spacing: 14) {
                            weekCard
                            feedCard
                        }
                    }
                }
            }
        }
    }

    private var firstName: String {
        state.profile(state.currentUserId)?.displayName.split(separator: " ").first.map(String.init) ?? "there"
    }

    // MARK: stats

    private var statsRow: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 14)], spacing: 14) {
            stat(value: "\(state.projects.filter { $0.status == .active }.count)", label: "Active projects", section: .projects)
            stat(value: formatHours(ms: weekMs), label: "Hours this week", section: .time)
            stat(value: "\(state.tasks.filter { $0.status == .inprogress }.count)", label: "Tasks in progress", section: .tasks)
            stat(value: "\(sinceCount)", label: "Updates in 24h", section: .home)
        }
    }

    private func stat(value: String, label: String, section: Section) -> some View {
        Button { openSection(section) } label: {
            GlassCard(padding: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(value)
                        .font(.system(size: 24, weight: .medium, design: .serif))
                        .foregroundStyle(Brand.ink)
                    MonoLabel(text: label)
                }
            }
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
            GlassCard {
                VStack(alignment: .leading, spacing: 10) {
                    MonoLabel(text: "Running now")
                    ForEach(running) { entry in
                        HStack(spacing: 8) {
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
            FeedItem(id: "time-\($0.id)", actorId: $0.userId, verb: "logged \(formatHours(ms: $0.durationMs()))", object: state.project($0.projectId)?.name ?? "a project", context: "time", kind: .time, at: $0.endedAt ?? $0.startedAt)
        }
        items += state.ideas.map {
            FeedItem(id: "idea-\($0.id)", actorId: $0.createdBy, verb: "captured", object: $0.title, context: "ideas", kind: .ideas, at: $0.updatedAt)
        }
        let filtered = mineOnly ? items.filter { $0.actorId == state.currentUserId } : items
        return filtered.sorted { parseISO($0.at) > parseISO($1.at) }.prefix(12).map { $0 }
    }

    private var sinceCount: Int {
        let cutoff = Date().addingTimeInterval(-24 * 3600)
        return feed.filter { parseISO($0.at) >= cutoff }.count
    }

    private var feedCard: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
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
                if feed.isEmpty {
                    EmptyStateView(symbol: "sparkles", title: "All quiet", message: "Team activity shows up here.")
                } else {
                    ForEach(feed) { item in
                        Button { openSection(item.kind) } label: {
                            HStack(spacing: 8) {
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
                                Spacer()
                                MonoLabel(text: item.context)
                                Text(relativeTime(item.at))
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundStyle(Brand.mutedText)
                            }
                            .contentShape(.rect)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    // MARK: 7-day activity bars

    private var weekCard: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                MonoLabel(text: "Last 7 days")
                let buckets = dayBuckets()
                let totals = buckets.map { bucket in
                    state.entries
                        .filter { parseISO($0.startedAt) >= bucket.start && parseISO($0.startedAt) < bucket.end }
                        .reduce(0.0) { $0 + $1.durationMs() }
                }
                let maxMs = max(totals.max() ?? 1, 1)
                HStack(alignment: .bottom, spacing: 8) {
                    ForEach(Array(buckets.enumerated()), id: \.offset) { i, bucket in
                        VStack(spacing: 5) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(bucket.isToday ? Brand.purple : Brand.ink.opacity(0.75))
                                .frame(height: max(4, 80 * totals[i] / maxMs))
                                .frame(maxWidth: .infinity)
                            Text(bucket.letter)
                                .font(.system(size: 9, weight: bucket.isToday ? .bold : .regular, design: .monospaced))
                                .foregroundStyle(bucket.isToday ? Brand.purple : Brand.mutedText)
                        }
                    }
                }
                .frame(height: 100, alignment: .bottom)
                Text("\(formatHours(ms: totals.reduce(0, +))) across the team")
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.mutedText)
            }
        }
    }
}
