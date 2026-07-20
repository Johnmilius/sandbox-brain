import SandboxBrainKit
import SwiftUI

// Tasks — the Mac kanban re-shaped for touch: status-grouped card list with a
// project filter; tap a card to edit (status moves happen in the sheet's
// segmented control instead of drag-and-drop).

struct TasksView: View {
    @Environment(AppState.self) private var state
    @State private var editing: TaskItem?
    @State private var creating = false
    @State private var projectFilter = ""

    var body: some View {
        Page(kicker: "Tasks", title: "The board", trailing: AnyView(
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
        )) {
            VStack(alignment: .leading, spacing: 18) {
                ForEach(TaskStatus.allCases, id: \.self) { status in
                    let group = tasksIn(status)
                    if !group.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                MonoLabel(text: status.label)
                                Text("\(group.count)")
                                    .font(.system(size: 10, design: .monospaced))
                                    .foregroundStyle(Brand.mutedText)
                            }
                            ForEach(group) { task in
                                Button { editing = task } label: { taskCard(task) }
                                    .buttonStyle(.plain)
                            }
                        }
                    }
                }
                if state.tasks.isEmpty {
                    EmptyStateView(symbol: "square.split.2x1", title: "No tasks yet", message: "Create the first ticket to get the board moving.")
                }
            }
        }
        .toolbarBackground(.hidden, for: .navigationBar)
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
    }

    private func tasksIn(_ status: TaskStatus) -> [TaskItem] {
        state.tasks
            .filter { $0.status == status && (projectFilter.isEmpty || $0.projectId == projectFilter) }
            .sorted { parseISO($0.updatedAt) > parseISO($1.updatedAt) }
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
