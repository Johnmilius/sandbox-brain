import SandboxBrainKit
import SwiftUI

// Projects — card grid (1 column on phone) with per-project timer start/stop,
// plus the create/edit sheet. Port of the Mac ProjectsView.

struct ProjectsView: View {
    @Environment(AppState.self) private var state
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var editing: Project?
    @State private var creating = false
    @State private var timerTick = Date()
    @State private var isVisible = false

    // @State so the publisher survives re-renders (hard-won Mac lesson).
    @State private var clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var columns: [GridItem] {
        horizontalSizeClass == .compact
            ? [GridItem(.flexible())]
            : [GridItem(.adaptive(minimum: 280), spacing: 14)]
    }

    var body: some View {
        Page(kicker: "Projects", title: "What we're building", trailing: AnyView(
            Button { creating = true } label: { Label("New", systemImage: "plus") }
                .buttonStyle(.glass)
        )) {
            if state.projects.isEmpty {
                EmptyStateView(symbol: "square.grid.2x2", title: "No projects yet", message: "Create the first project to start tracking time and tasks against it.")
            } else {
                LazyVGrid(columns: columns, spacing: 14) {
                    ForEach(state.projects) { project in
                        projectCard(project)
                    }
                }
            }
        }
        .toolbarBackground(.hidden, for: .navigationBar)
        .navigationTitle("Projects")
        .navigationBarTitleDisplayMode(.inline)
        .onReceive(clock) { timerTick = $0 }
        .onAppear { isVisible = true }
        .onDisappear { isVisible = false }
        // Haptic on timer start/stop from the card chips — same trigger as
        // TimeView (the confirmed myRunningEntry transition, not the tap), with
        // the same visibility guard so only whichever screen is frontmost fires.
        .sensoryFeedback(trigger: state.myRunningEntry?.id) { oldValue, newValue in
            guard isVisible else { return nil }
            if oldValue == nil, newValue != nil { return .impact }   // started
            if oldValue != nil, newValue == nil { return .success }  // stopped
            return nil
        }
        .sheet(item: $editing) {
            ProjectSheet(project: $0)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $creating) {
            ProjectSheet(project: nil)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }

    private func projectCard(_ project: Project) -> some View {
        let totalMs = state.entries.filter { $0.projectId == project.id }.reduce(0.0) { $0 + $1.durationMs(now: timerTick) }
        let openTasks = state.tasks.filter { $0.projectId == project.id && $0.status != .done }.count
        let runningHere = state.myRunningEntry.flatMap { $0.projectId == project.id ? $0 : nil }
        return GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                Button { editing = project } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(project.name)
                                .font(.system(size: 16, weight: .semibold, design: .serif))
                                .foregroundStyle(Brand.ink)
                            Spacer()
                            StatusPill(label: project.status.rawValue, color: Brand.status(project.status))
                        }
                        Text(project.description ?? " ")
                            .font(.system(size: 12))
                            .foregroundStyle(Brand.mutedText)
                            .lineLimit(2, reservesSpace: true)
                            .multilineTextAlignment(.leading)
                        HStack(spacing: 12) {
                            Label(formatHours(ms: totalMs), systemImage: "clock")
                            Label("\(openTasks) open", systemImage: "square.split.2x1")
                            if let prefix = project.ticketPrefix {
                                MonoLabel(text: prefix)
                            }
                        }
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Brand.mutedText)
                    }
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)

                // Timer start/stop straight from the card.
                if let running = runningHere {
                    Button {
                        state.perform { [id = running.id, backend = state.backend] in
                            try await backend?.stopTimer(entryId: id)
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Circle().fill(Brand.green).frame(width: 6, height: 6)
                            Text(formatClock(ms: running.durationMs(now: timerTick)))
                                .font(.system(size: 12, design: .monospaced))
                                .contentTransition(.numericText())
                            Image(systemName: "stop.fill").font(.system(size: 9))
                            Text("Stop").font(.system(size: 12, weight: .medium))
                        }
                    }
                    .buttonStyle(.glassProminent)
                    .tint(.red)
                } else if project.status == .active {
                    Button {
                        state.perform { [projectId = project.id, backend = state.backend] in
                            try await backend?.startTimer(projectId: projectId, notes: nil)
                        }
                    } label: {
                        Label("Start timer", systemImage: "play.fill")
                            .font(.system(size: 12, weight: .medium))
                    }
                    .buttonStyle(.glass)
                    .disabled(state.myRunningEntry != nil)
                }
            }
        }
    }
}

struct ProjectSheet: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss

    let project: Project?
    @State private var name = ""
    @State private var description = ""
    @State private var status: ProjectStatus = .active

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                TextField("Description", text: $description, axis: .vertical)
                    .lineLimit(3...5)
                Picker("Status", selection: $status) {
                    ForEach(ProjectStatus.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
                }
                if let project {
                    SwiftUI.Section {
                        Button("Delete project", role: .destructive) {
                            state.perform { [id = project.id, backend = state.backend] in
                                try await backend?.deleteProject(id: id)
                            }
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle(project == nil ? "New project" : "Edit project")
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
                if let project {
                    name = project.name
                    description = project.description ?? ""
                    status = project.status
                }
            }
        }
    }

    private func save() {
        if var updated = project {
            updated.name = name
            updated.description = description.isEmpty ? nil : description
            updated.status = status
            state.perform { [backend = state.backend] in try await backend?.updateProject(updated) }
        } else {
            state.perform { [name, description, status, backend = state.backend] in
                try await backend?.createProject(name: name, description: description.isEmpty ? nil : description, status: status)
            }
        }
        dismiss()
    }
}
