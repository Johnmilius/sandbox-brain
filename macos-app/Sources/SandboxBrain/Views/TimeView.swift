import SwiftUI

// Time — start/stop timers, weekly per-person + per-project totals, entry log.
// Ports src/app/time/page.tsx.

struct TimeView: View {
    @Environment(AppState.self) private var state
    @State private var timerProject: String = ""
    @State private var showingManual = false
    @State private var timerTick = Date()

    // @State so the publisher survives re-renders: the sidebar's ticking clock
    // reconstructs this view every second, and a `let` publisher would be
    // replaced before ever firing — freezing the big timer at 00:00.
    @State private var clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        Page(kicker: "Time", title: "This week", trailing: AnyView(
            Button { showingManual = true } label: {
                Label("Log time", systemImage: "plus")
            }
            .buttonStyle(.glass)
        )) {
            GlassEffectContainer(spacing: 14) {
                VStack(alignment: .leading, spacing: 14) {
                    timerCard
                    ViewThatFits(in: .horizontal) {
                        HStack(alignment: .top, spacing: 14) {
                            peopleCard.frame(minWidth: 320)
                            projectsCard.frame(minWidth: 320)
                        }
                        VStack(alignment: .leading, spacing: 14) {
                            peopleCard
                            projectsCard
                        }
                    }
                    entriesCard
                }
            }
        }
        .onReceive(clock) { timerTick = $0 }
        .sheet(isPresented: $showingManual) { ManualEntrySheet() }
    }

    private var weekEntries: [TimeEntry] {
        let start = weekStartLocal()
        return state.entries.filter { parseISO($0.startedAt) >= start || $0.isRunning }
    }

    // MARK: timer

    private var timerCard: some View {
        GlassCard {
            HStack(spacing: 12) {
                if let running = state.myRunningEntry {
                    Circle().fill(Brand.green).frame(width: 8, height: 8)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(state.project(running.projectId)?.name ?? "Running")
                            .font(.system(size: 14, weight: .semibold))
                        MonoLabel(text: "Timer running")
                    }
                    Spacer()
                    Text(formatClock(ms: running.durationMs(now: timerTick)))
                        .font(.system(size: 26, weight: .medium, design: .monospaced))
                        .contentTransition(.numericText())
                    Button {
                        state.perform { [id = running.id, backend = state.backend] in
                            try await backend?.stopTimer(entryId: id)
                        }
                    } label: {
                        Label("Stop", systemImage: "stop.fill")
                    }
                    .buttonStyle(.glassProminent)
                    .tint(.red)
                } else {
                    Image(systemName: "timer")
                        .foregroundStyle(Brand.mutedText)
                    Picker("Project", selection: $timerProject) {
                        Text("Pick a project…").tag("")
                        ForEach(state.projects.filter { $0.status == .active }) { p in
                            Text(p.name).tag(p.id)
                        }
                    }
                    .labelsHidden()
                    .frame(maxWidth: 280)
                    Spacer()
                    Button {
                        state.perform { [projectId = timerProject, backend = state.backend] in
                            try await backend?.startTimer(projectId: projectId, notes: nil)
                        }
                    } label: {
                        Label("Start timer", systemImage: "play.fill")
                    }
                    .buttonStyle(.glassProminent)
                    .tint(Brand.inkSolid)
                    .disabled(timerProject.isEmpty)
                }
            }
        }
    }

    // MARK: weekly totals

    private var peopleCard: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                MonoLabel(text: "By person")
                let totals = Dictionary(grouping: weekEntries, by: \.userId)
                    .mapValues { $0.reduce(0.0) { $0 + $1.durationMs(now: timerTick) } }
                let maxMs = max(totals.values.max() ?? 1, 1)
                if totals.isEmpty {
                    Text("No hours yet this week.")
                        .font(.system(size: 12)).foregroundStyle(Brand.mutedText)
                }
                ForEach(totals.sorted { $0.value > $1.value }, id: \.key) { userId, ms in
                    let color = Brand.identity(userId, profiles: state.profiles)
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            AvatarView(profile: state.profile(userId), size: 20, color: color)
                            Text(state.profile(userId)?.displayName ?? "Unknown")
                                .font(.system(size: 12.5, weight: .medium))
                            Spacer()
                            Text(formatHours(ms: ms))
                                .font(.system(size: 12, design: .monospaced))
                        }
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Brand.accentField)
                                Capsule().fill(color).frame(width: geo.size.width * ms / maxMs)
                            }
                        }
                        .frame(height: 6)
                    }
                }
            }
        }
    }

    private var projectsCard: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                MonoLabel(text: "By project")
                let totals = Dictionary(grouping: weekEntries, by: \.projectId)
                    .mapValues { $0.reduce(0.0) { $0 + $1.durationMs(now: timerTick) } }
                let maxMs = max(totals.values.max() ?? 1, 1)
                if totals.isEmpty {
                    Text("No hours yet this week.")
                        .font(.system(size: 12)).foregroundStyle(Brand.mutedText)
                }
                ForEach(totals.sorted { $0.value > $1.value }, id: \.key) { projectId, ms in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(state.project(projectId)?.name ?? "Unknown")
                                .font(.system(size: 12.5, weight: .medium))
                            Spacer()
                            Text(formatHours(ms: ms))
                                .font(.system(size: 12, design: .monospaced))
                        }
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Brand.accentField)
                                Capsule().fill(Brand.ink).frame(width: geo.size.width * ms / maxMs)
                            }
                        }
                        .frame(height: 6)
                    }
                }
            }
        }
    }

    // MARK: entries log

    private var entriesCard: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                MonoLabel(text: "Entries")
                let sorted = state.entries.sorted { parseISO($0.startedAt) > parseISO($1.startedAt) }.prefix(30)
                if sorted.isEmpty {
                    EmptyStateView(symbol: "clock", title: "No entries", message: "Start a timer or log time manually.")
                }
                ForEach(Array(sorted)) { entry in
                    HStack(spacing: 10) {
                        AvatarView(profile: state.profile(entry.userId), size: 22,
                                   color: Brand.identity(entry.userId, profiles: state.profiles))
                        VStack(alignment: .leading, spacing: 1) {
                            HStack(spacing: 6) {
                                Text(state.project(entry.projectId)?.name ?? "Unknown")
                                    .font(.system(size: 13, weight: .medium))
                                if entry.isRunning {
                                    StatusPill(label: "running", color: Brand.green)
                                }
                                StatusPill(label: entry.source.rawValue, color: Brand.mutedText)
                            }
                            if let notes = entry.notes, !notes.isEmpty {
                                Text(notes).font(.system(size: 11.5)).foregroundStyle(Brand.mutedText).lineLimit(1)
                            }
                        }
                        Spacer()
                        Text(parseISO(entry.startedAt).formatted(date: .abbreviated, time: .shortened))
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(Brand.mutedText)
                        Text(formatHours(ms: entry.durationMs(now: timerTick)))
                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                            .frame(width: 48, alignment: .trailing)
                        Button {
                            state.perform { [id = entry.id, backend = state.backend] in
                                try await backend?.deleteTimeEntry(id: id)
                            }
                        } label: {
                            Image(systemName: "trash").font(.system(size: 10))
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(Brand.mutedText)
                        .help("Delete entry")
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }
}

// MARK: - Manual entry sheet

struct ManualEntrySheet: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss

    @State private var projectId = ""
    @State private var start = Calendar.current.date(byAdding: .hour, value: -1, to: Date())!
    @State private var end = Date()
    @State private var notes = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Log time")
                .font(.system(size: 20, weight: .medium, design: .serif))
            Picker("Project", selection: $projectId) {
                Text("Pick a project…").tag("")
                ForEach(state.projects) { p in Text(p.name).tag(p.id) }
            }
            DatePicker("Started", selection: $start)
            DatePicker("Ended", selection: $end)
            TextField("Notes (optional)", text: $notes)
                .textFieldStyle(.roundedBorder)
            HStack {
                Spacer()
                Button("Cancel") { dismiss() }
                Button("Save") {
                    state.perform { [projectId, start, end, notes, backend = state.backend] in
                        try await backend?.addManualEntry(projectId: projectId, start: start, end: end, notes: notes.isEmpty ? nil : notes)
                    }
                    dismiss()
                }
                .buttonStyle(.glassProminent)
                .tint(Brand.inkSolid)
                .disabled(projectId.isEmpty || end <= start)
            }
        }
        .padding(22)
        .frame(width: 420)
    }
}
