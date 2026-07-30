import SandboxBrainKit
import SwiftUI

// Tasks — the Mac kanban board re-shaped for touch: full-height columns that
// page horizontally (view-aligned snapping with the next column peeking), with
// drag-and-drop between columns. Drop on the peeking sliver to move a card one
// column over; the status picker inside the edit sheet remains as a fallback.

struct TasksView: View {
    @Environment(AppState.self) private var state
    @State private var editing: TaskItem?
    @State private var creating = false
    @State private var projectFilter = ""
    @State private var dropTarget: TaskStatus?
    /// Bumped only when an optimistic move actually mutates a task's status,
    /// so failed/no-op drops don't buzz.
    @State private var landedDrops = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            header
                .padding(.horizontal, 24)
                .padding(.top, 24)
            if state.tasks.isEmpty {
                ScrollView {
                    EmptyStateView(symbol: "square.split.2x1", title: "No tasks yet", message: "Create the first ticket to get the board moving.")
                        .padding(24)
                }
            } else {
                board
            }
        }
        .background(Brand.cream)
        .toolbarBackground(.hidden, for: .navigationBar)
        .sensoryFeedback(.impact(weight: .light), trigger: landedDrops)
        .sheet(item: $editing) {
            TaskSheet(task: $0)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $creating) {
            TaskSheet(task: nil)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .task { await applyVerificationHook() }
    }

    /// Dev/verification hook (same SIMCTL_CHILD_SB_* pattern as DemoDriver):
    /// SB_OPEN_TASK=1 opens the first task's edit sheet for simulator
    /// screenshots. No-op outside that environment.
    private func applyVerificationHook() async {
        guard ProcessInfo.processInfo.environment["SB_OPEN_TASK"] == "1" else { return }
        for _ in 0..<40 where state.tasks.isEmpty {
            try? await Task.sleep(for: .milliseconds(100))
        }
        editing = tasksIn(.inprogress).first ?? state.tasks.first
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 4) {
                MonoLabel(text: "Tasks")
                PageTitle(text: "The board")
            }
            Spacer()
            HStack(spacing: 8) {
                Menu {
                    Picker("Project", selection: $projectFilter) {
                        Text("All projects").tag("")
                        ForEach(state.projects) { Text($0.name).tag($0.id) }
                    }
                } label: {
                    Image(systemName: "line.3.horizontal.decrease.circle\(projectFilter.isEmpty ? "" : ".fill")")
                        .font(.system(size: 17))
                        .foregroundStyle(Brand.ink)
                }
                Button { creating = true } label: { Label("New", systemImage: "plus") }
                    .buttonStyle(.glass)
            }
        }
    }

    // MARK: Board

    private var board: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 12) {
                ForEach(TaskStatus.allCases, id: \.self) { column in
                    kanbanColumn(column)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.viewAligned)
        .contentMargins(.horizontal, 24, for: .scrollContent)
    }

    private func tasksIn(_ status: TaskStatus) -> [TaskItem] {
        state.tasks
            .filter { $0.status == status && (projectFilter.isEmpty || $0.projectId == projectFilter) }
            .sorted { parseISO($0.updatedAt) > parseISO($1.updatedAt) }
    }

    private func kanbanColumn(_ status: TaskStatus) -> some View {
        let group = tasksIn(status)
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                MonoLabel(text: status.label)
                Text("\(group.count)")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(Brand.mutedText)
            }
            .padding(.horizontal, 4)
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    ForEach(group) { task in
                        Button { editing = task } label: { taskCard(task) }
                            .buttonStyle(.plain)
                            .draggable(task.id)
                    }
                    if group.isEmpty {
                        Text("Drop tasks here")
                            .font(.system(size: 11))
                            .foregroundStyle(Brand.mutedText)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 32)
                    }
                    // Trailing drop runway so short columns still catch drops.
                    Color.clear.frame(height: 120)
                }
            }
            .scrollIndicators(.hidden)
        }
        .padding(6)
        .containerRelativeFrame(.horizontal) { length, _ in min(length * 0.78, 300) }
        .frame(maxHeight: .infinity, alignment: .top)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(dropTarget == status ? Brand.purple.opacity(0.08) : Brand.accentField.opacity(0.45))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(dropTarget == status ? Brand.purple.opacity(0.5) : .clear,
                              style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
        )
        .contentShape(.rect)
        .dropDestination(for: String.self) { ids, _ in
            guard let id = ids.first,
                  let task = state.tasks.first(where: { $0.id == id }),
                  task.status != status else { return false }
            move(task, to: status)
            return true
        } isTargeted: { targeted in
            withAnimation(.snappy(duration: 0.15)) {
                dropTarget = targeted ? status : (dropTarget == status ? nil : dropTarget)
            }
        }
    }

    /// Optimistic move: the card jumps immediately; the write happens behind
    /// it, and `perform` resyncs from the database either way (so failures
    /// roll the board back to the server's truth).
    private func move(_ task: TaskItem, to status: TaskStatus) {
        var updated = task
        updated.status = status
        updated.updatedAt = isoNow()
        if let index = state.tasks.firstIndex(where: { $0.id == task.id }) {
            withAnimation(.snappy) { state.tasks[index] = updated }
            landedDrops += 1  // haptic fires off the mutation, not the gesture
        }
        state.perform { [backend = state.backend] in
            try await backend?.updateTask(updated)
        }
    }

    private func taskCard(_ task: TaskItem) -> some View {
        FlatCard(padding: 12) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    MonoLabel(text: "\(state.project(task.projectId)?.ticketPrefix ?? "T")-\(task.ticketNum)")
                    Spacer()
                    StatusPill(label: task.priority.label, color: Brand.priority(task.priority))
                }
                Text(task.title)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Brand.ink)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                HStack {
                    StatusPill(label: task.area.rawValue, color: Brand.mutedText)
                    if !task.checklist.isEmpty {
                        let done = task.checklist.filter(\.done).count
                        Label("\(done)/\(task.checklist.count)", systemImage: "checklist")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(Brand.mutedText)
                    }
                    Spacer()
                    if let claimedBy = task.claimedBy {
                        AvatarView(profile: state.profile(claimedBy), size: 18,
                                   color: Brand.identity(claimedBy, profiles: state.profiles))
                    }
                }
            }
        }
    }
}

struct TaskSheet: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss

    let task: TaskItem?
    @State private var title = ""
    @State private var details = ""
    @State private var projectId = ""
    @State private var priority: TaskPriority = .med
    @State private var area: TaskArea = .frontend
    @State private var status: TaskStatus = .backlog
    @State private var checklist: [ChecklistItem] = []
    @State private var newChecklistItem = ""

    var body: some View {
        NavigationStack {
            Form {
                SwiftUI.Section {
                    TextField("Title", text: $title)
                    TextField("Description", text: $details, axis: .vertical)
                        .lineLimit(2...4)
                    if task == nil {
                        Picker("Project", selection: $projectId) {
                            Text("Pick a project…").tag("")
                            ForEach(state.projects) { Text($0.name).tag($0.id) }
                        }
                    }
                    Picker("Priority", selection: $priority) {
                        ForEach(TaskPriority.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    Picker("Area", selection: $area) {
                        ForEach(TaskArea.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
                    }
                }

                if task != nil {
                    SwiftUI.Section("Status") {
                        Picker("Status", selection: $status) {
                            ForEach(TaskStatus.allCases, id: \.self) { Text($0.label).tag($0) }
                        }
                        .pickerStyle(.menu)
                    }

                    SwiftUI.Section("Checklist") {
                        ForEach(checklist.indices, id: \.self) { i in
                            Toggle(isOn: $checklist[i].done) {
                                Text(checklist[i].text).font(.system(size: 13))
                            }
                        }
                        .onDelete { checklist.remove(atOffsets: $0) }
                        HStack {
                            TextField("Add item", text: $newChecklistItem)
                                .onSubmit(addChecklistItem)
                            Button("Add", action: addChecklistItem)
                                .disabled(newChecklistItem.isEmpty)
                        }
                    }
                }

                if let task {
                    SwiftUI.Section {
                        if task.claimedBy == nil {
                            Button("Claim this task") {
                                var updated = task
                                updated.claimedBy = state.currentUserId
                                updated.assignee = state.currentUserId
                                state.perform { [backend = state.backend] in try await backend?.updateTask(updated) }
                                dismiss()
                            }
                        }
                        Button("Delete task", role: .destructive) {
                            state.perform { [id = task.id, backend = state.backend] in try await backend?.deleteTask(id: id) }
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle(task == nil ? "New task" : "\(state.project(task?.projectId)?.ticketPrefix ?? "T")-\(task?.ticketNum ?? 0)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(title.isEmpty || (task == nil && projectId.isEmpty))
                }
            }
            .onAppear {
                if let task {
                    title = task.title
                    details = task.description ?? ""
                    priority = task.priority
                    area = task.area
                    status = task.status
                    checklist = task.checklist
                }
            }
        }
    }

    private func addChecklistItem() {
        guard !newChecklistItem.isEmpty else { return }
        checklist.append(ChecklistItem(text: newChecklistItem, done: false))
        newChecklistItem = ""
    }

    private func save() {
        if var updated = task {
            updated.title = title
            updated.description = details.isEmpty ? nil : details
            updated.priority = priority
            updated.area = area
            updated.status = status
            updated.checklist = checklist
            state.perform { [backend = state.backend] in try await backend?.updateTask(updated) }
        } else {
            state.perform { [projectId, title, details, priority, area, backend = state.backend] in
                try await backend?.createTask(projectId: projectId, title: title, description: details.isEmpty ? nil : details, priority: priority, area: area)
            }
        }
        dismiss()
    }
}
