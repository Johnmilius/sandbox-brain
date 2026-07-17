import SandboxBrainKit
import SwiftUI

// MARK: - Projects (grid of cards + editor)

struct ProjectsView: View {
    @Environment(AppState.self) private var state
    @State private var editing: Project?
    @State private var creating = false

    private let columns = [GridItem(.adaptive(minimum: 280), spacing: 14)]

    var body: some View {
        Page(kicker: "Projects", title: "What we're building", trailing: AnyView(
            Button { creating = true } label: { Label("New project", systemImage: "plus") }
                .buttonStyle(.glass)
        )) {
            if state.projects.isEmpty {
                EmptyStateView(symbol: "square.grid.2x2", title: "No projects yet", message: "Create the first project to start tracking time and tasks against it.")
            } else {
                LazyVGrid(columns: columns, spacing: 14) {
                    ForEach(state.projects) { project in
                        Button { editing = project } label: {
                            projectCard(project)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .sheet(item: $editing) { ProjectSheet(project: $0) }
        .sheet(isPresented: $creating) { ProjectSheet(project: nil) }
    }

    private func projectCard(_ project: Project) -> some View {
        let totalMs = state.entries.filter { $0.projectId == project.id }.reduce(0.0) { $0 + $1.durationMs() }
        let openTasks = state.tasks.filter { $0.projectId == project.id && $0.status != .done }.count
        return GlassCard {
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
        VStack(alignment: .leading, spacing: 16) {
            Text(project == nil ? "New project" : "Edit project")
                .font(.system(size: 20, weight: .medium, design: .serif))
            TextField("Name", text: $name).textFieldStyle(.roundedBorder)
            TextField("Description", text: $description, axis: .vertical)
                .lineLimit(3...5)
                .textFieldStyle(.roundedBorder)
            Picker("Status", selection: $status) {
                ForEach(ProjectStatus.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
            }
            HStack {
                if let project {
                    Button("Delete", role: .destructive) {
                        state.perform { [id = project.id, backend = state.backend] in
                            try await backend?.deleteProject(id: id)
                        }
                        dismiss()
                    }
                }
                Spacer()
                Button("Cancel") { dismiss() }
                Button("Save") {
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
                .buttonStyle(.glassProminent)
                .tint(Brand.inkSolid)
                .disabled(name.isEmpty)
            }
        }
        .padding(22)
        .frame(width: 440)
        .onAppear {
            if let project {
                name = project.name
                description = project.description ?? ""
                status = project.status
            }
        }
    }
}

// MARK: - Tasks (kanban board + editor)

struct TasksView: View {
    @Environment(AppState.self) private var state
    @State private var editing: TaskItem?
    @State private var creating = false
    @State private var projectFilter = ""
    @State private var dropTarget: TaskStatus?

    var body: some View {
        Page(kicker: "Tasks", title: "The board", trailing: AnyView(
            HStack {
                Picker("", selection: $projectFilter) {
                    Text("All projects").tag("")
                    ForEach(state.projects) { Text($0.name).tag($0.id) }
                }
                .frame(maxWidth: 200)
                Button { creating = true } label: { Label("New task", systemImage: "plus") }
                    .buttonStyle(.glass)
            }
        )) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 12) {
                    ForEach(TaskStatus.allCases, id: \.self) { column in
                        kanbanColumn(column)
                    }
                }
            }
        }
        .sheet(item: $editing) { TaskSheet(task: $0) }
        .sheet(isPresented: $creating) { TaskSheet(task: nil) }
    }

    private func tasksIn(_ status: TaskStatus) -> [TaskItem] {
        state.tasks
            .filter { $0.status == status && (projectFilter.isEmpty || $0.projectId == projectFilter) }
            .sorted { parseISO($0.updatedAt) > parseISO($1.updatedAt) }
    }

    private func kanbanColumn(_ status: TaskStatus) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                MonoLabel(text: status.label)
                Text("\(tasksIn(status).count)")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(Brand.mutedText)
            }
            .padding(.horizontal, 4)
            ForEach(tasksIn(status)) { task in
                Button { editing = task } label: { taskCard(task) }
                    .buttonStyle(.plain)
                    .draggable(task.id)
            }
            Spacer(minLength: 0)
        }
        .padding(6)
        .frame(width: 230, alignment: .top)
        .frame(minHeight: 420, alignment: .top)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(dropTarget == status ? Brand.purple.opacity(0.08) : .clear)
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
    /// it, and `perform` resyncs from the database either way.
    private func move(_ task: TaskItem, to status: TaskStatus) {
        var updated = task
        updated.status = status
        updated.updatedAt = isoNow()
        if let index = state.tasks.firstIndex(where: { $0.id == task.id }) {
            withAnimation(.snappy) { state.tasks[index] = updated }
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
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(task == nil ? "New task" : "\(state.project(task?.projectId)?.ticketPrefix ?? "T")-\(task?.ticketNum ?? 0)")
                    .font(.system(size: 20, weight: .medium, design: .serif))
                Spacer()
                if let task, task.claimedBy == nil {
                    Button("Claim") {
                        var updated = task
                        updated.claimedBy = state.currentUserId
                        updated.assignee = state.currentUserId
                        state.perform { [backend = state.backend] in try await backend?.updateTask(updated) }
                        dismiss()
                    }
                    .buttonStyle(.glass)
                }
            }
            TextField("Title", text: $title).textFieldStyle(.roundedBorder)
            TextField("Description", text: $details, axis: .vertical)
                .lineLimit(2...4).textFieldStyle(.roundedBorder)
            if task == nil {
                Picker("Project", selection: $projectId) {
                    Text("Pick a project…").tag("")
                    ForEach(state.projects) { Text($0.name).tag($0.id) }
                }
            }
            HStack {
                Picker("Priority", selection: $priority) {
                    ForEach(TaskPriority.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                Picker("Area", selection: $area) {
                    ForEach(TaskArea.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
                }
            }
            if task != nil {
                Picker("Status", selection: $status) {
                    ForEach(TaskStatus.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)

                VStack(alignment: .leading, spacing: 6) {
                    MonoLabel(text: "Checklist")
                    ForEach(checklist.indices, id: \.self) { i in
                        HStack {
                            Toggle(isOn: $checklist[i].done) { Text(checklist[i].text).font(.system(size: 12)) }
                            Spacer()
                            Button { checklist.remove(at: i) } label: { Image(systemName: "xmark").font(.system(size: 9)) }
                                .buttonStyle(.plain).foregroundStyle(Brand.mutedText)
                        }
                    }
                    HStack {
                        TextField("Add item", text: $newChecklistItem)
                            .textFieldStyle(.roundedBorder)
                            .onSubmit(addChecklistItem)
                        Button("Add", action: addChecklistItem).disabled(newChecklistItem.isEmpty)
                    }
                }
            }
            HStack {
                if let task {
                    Button("Delete", role: .destructive) {
                        state.perform { [id = task.id, backend = state.backend] in try await backend?.deleteTask(id: id) }
                        dismiss()
                    }
                }
                Spacer()
                Button("Cancel") { dismiss() }
                Button("Save") { save() }
                    .buttonStyle(.glassProminent)
                    .tint(Brand.inkSolid)
                    .disabled(title.isEmpty || (task == nil && projectId.isEmpty))
            }
        }
        .padding(22)
        .frame(width: 480)
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
