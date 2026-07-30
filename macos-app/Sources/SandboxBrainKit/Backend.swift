import Foundation
import Supabase

// MARK: - Backend protocol
//
// Every screen talks to this protocol. `LiveBackend` hits Supabase (same
// tables + RLS as the web app); `DemoBackend` serves seeded in-memory data so
// anyone can explore the app before wiring up credentials.

public protocol BrainBackend: Sendable {
    func currentUserId() async -> String?
    func isTeamMember() async throws -> Bool
    func signOut() async

    func profiles() async throws -> [Profile]
    func projects() async throws -> [Project]
    func createProject(name: String, description: String?, status: ProjectStatus) async throws
    func updateProject(_ project: Project) async throws
    func deleteProject(id: String) async throws

    func timeEntries(since: Date?) async throws -> [TimeEntry]
    func startTimer(projectId: String, notes: String?) async throws
    func stopTimer(entryId: String) async throws
    func addManualEntry(projectId: String, start: Date, end: Date, notes: String?) async throws
    func deleteTimeEntry(id: String) async throws

    func tasks() async throws -> [TaskItem]
    func createTask(projectId: String, title: String, description: String?, priority: TaskPriority, area: TaskArea) async throws
    func updateTask(_ task: TaskItem) async throws
    func deleteTask(id: String) async throws

    func notes() async throws -> [Note]
    func createNote(title: String, body: String) async throws
    func updateNote(_ note: Note) async throws
    func deleteNote(id: String) async throws

    func prompts() async throws -> [Prompt]
    func createPrompt(title: String, text: String, responseNotes: String?, aiTool: String?, rating: Int?, projectId: String?) async throws
    func updatePrompt(_ prompt: Prompt) async throws
    func deletePrompt(id: String) async throws

    func knowledgeItems() async throws -> [KnowledgeItem]
    func createKnowledgeItem(kind: KnowledgeKind, title: String, description: String?, content: String?, url: String?, projectId: String?) async throws
    func updateKnowledgeItem(_ item: KnowledgeItem) async throws
    func deleteKnowledgeItem(id: String) async throws

    func agents() async throws -> [Agent]
    func createAgent(name: String, description: String?, systemPrompt: String?, model: String?, tools: [String], projectId: String?) async throws
    func updateAgent(_ agent: Agent) async throws
    func deleteAgent(id: String) async throws

    func ideas() async throws -> [Idea]
    func createIdea(title: String, tagline: String?) async throws
    func updateIdea(_ idea: Idea) async throws
    func deleteIdea(id: String) async throws

    func academyModules() async throws -> [AcademyModule]
    func academySteps() async throws -> [AcademyStep]
    func stepProgress() async throws -> [StepProgress]
    func setStep(stepId: String, complete: Bool) async throws
    func outcomes() async throws -> [AcademyOutcome]
    func assessments() async throws -> [OutcomeAssessment]
    func upsertAssessment(outcomeId: String, rating: Int, confidence: Int?, note: String?) async throws

    func links() async throws -> [EntityLink]
    func search(_ query: String) async throws -> [SearchHit]
}

// MARK: - Live Supabase backend

final class LiveBackend: BrainBackend {
    let client: SupabaseClient

    init(url: URL, anonKey: String) {
        client = SupabaseClient(supabaseURL: url, supabaseKey: anonKey)
    }

    // Internal (not private) so Events.swift can append to `events` on the same
    // client the mutation used.
    var db: PostgrestClient { client.schema("public") }

    func currentUserId() async -> String? {
        try? await client.auth.session.user.id.uuidString.lowercased()
    }

    func isTeamMember() async throws -> Bool {
        try await db.rpc("is_team_member").execute().value
    }

    func signOut() async {
        try? await client.auth.signOut()
    }

    // MARK: fetches

    func profiles() async throws -> [Profile] {
        try await db.from("profiles").select().order("created_at").execute().value
    }

    func projects() async throws -> [Project] {
        try await db.from("projects").select().order("created_at", ascending: false).execute().value
    }

    func timeEntries(since: Date?) async throws -> [TimeEntry] {
        var query = db.from("time_entries").select()
        if let since {
            query = query.or("started_at.gte.\(iso(since)),ended_at.is.null")
        }
        return try await query.order("started_at", ascending: false).limit(1000).execute().value
    }

    func tasks() async throws -> [TaskItem] {
        try await db.from("tasks").select().order("updated_at", ascending: false).execute().value
    }

    func notes() async throws -> [Note] {
        try await db.from("notes").select().order("updated_at", ascending: false).execute().value
    }

    func prompts() async throws -> [Prompt] {
        try await db.from("prompts").select().order("updated_at", ascending: false).execute().value
    }

    func knowledgeItems() async throws -> [KnowledgeItem] {
        try await db.from("knowledge_items").select().order("updated_at", ascending: false).execute().value
    }

    func agents() async throws -> [Agent] {
        try await db.from("agents").select().order("updated_at", ascending: false).execute().value
    }

    func ideas() async throws -> [Idea] {
        try await db.from("ideas").select().order("updated_at", ascending: false).execute().value
    }

    func academyModules() async throws -> [AcademyModule] {
        try await db.from("academy_modules").select().order("sort_order").execute().value
    }

    func academySteps() async throws -> [AcademyStep] {
        try await db.from("academy_steps").select().order("step_no").execute().value
    }

    func stepProgress() async throws -> [StepProgress] {
        try await db.from("academy_step_progress").select().execute().value
    }

    func outcomes() async throws -> [AcademyOutcome] {
        try await db.from("academy_outcomes").select().order("sort_order").execute().value
    }

    func assessments() async throws -> [OutcomeAssessment] {
        try await db.from("academy_outcome_assessments").select().execute().value
    }

    func links() async throws -> [EntityLink] {
        try await db.from("links").select().limit(2000).execute().value
    }

    // MARK: mutations
    //
    // Every mutation below appends one row to `events` (Events.swift) so the
    // web app's activity feed and History panels see Mac/iOS writes. Verb,
    // object type, label, project scope, and metadata are matched action-for-
    // action against src/app/*/actions.ts. `emit` never throws, so it can't
    // undo or mask the write it follows.

    private struct ProjectPayload: Encodable {
        var name: String
        var description: String?
        var status: String
        var ticket_prefix: String?
    }

    func createProject(name: String, description: String?, status: ProjectStatus) async throws {
        let created: [InsertedProject] = try await db.from("projects")
            .insert(ProjectPayload(name: name, description: description, status: status.rawValue, ticket_prefix: nil))
            .select("id, name")
            .execute().value
        guard let project = created.first else { return }
        await emit(.created, EventObject(.project, project.id, label: project.name), projectId: project.id)
    }

    func updateProject(_ p: Project) async throws {
        try await db.from("projects")
            .update(ProjectPayload(name: p.name, description: p.description, status: p.status.rawValue, ticket_prefix: p.ticketPrefix))
            .eq("id", value: p.id)
            .execute()
        await emit(
            EventRules.projectUpdateVerb(status: p.status),
            EventObject(.project, p.id, label: p.name),
            projectId: p.id
        )
    }

    func deleteProject(id: String) async throws {
        // Label first — it's gone after the delete.
        let name = await eventLabel(table: "projects", id: id, column: "name")
        try await db.from("projects").delete().eq("id", value: id).execute()
        // Deliberately unscoped — see EventRules.projectDeleted.
        await emit(EventRules.projectDeleted(id: id, name: name))
    }

    private struct TimeEntryPayload: Encodable {
        var project_id: String
        var started_at: String
        var ended_at: String?
        var notes: String?
        var source: String
    }

    func startTimer(projectId: String, notes: String?) async throws {
        let created: [InsertedId] = try await db.from("time_entries")
            .insert(TimeEntryPayload(project_id: projectId, started_at: isoNow(), ended_at: nil, notes: notes, source: "timer"))
            .select("id")
            .execute().value
        guard let entry = created.first else { return }
        await emit(
            .started,
            EventObject(.timeEntry, entry.id),
            target: await projectTarget(projectId),
            projectId: projectId
        )
    }

    func stopTimer(entryId: String) async throws {
        let stopped: [StoppedTimer] = try await db.from("time_entries")
            .update(["ended_at": isoNow()])
            .eq("id", value: entryId)
            .select("id, project_id, started_at, ended_at")
            .execute().value
        guard let entry = stopped.first else { return }
        var metadata: [String: EventMetaValue] = ["started_at": .text(entry.started_at)]
        if let endedAt = entry.ended_at { metadata["ended_at"] = .text(endedAt) }
        await emit(
            .loggedTime,
            EventObject(.timeEntry, entry.id),
            target: await projectTarget(entry.project_id),
            projectId: entry.project_id,
            metadata: metadata
        )
    }

    func addManualEntry(projectId: String, start: Date, end: Date, notes: String?) async throws {
        let created: [InsertedId] = try await db.from("time_entries")
            .insert(TimeEntryPayload(project_id: projectId, started_at: iso(start), ended_at: iso(end), notes: notes, source: "manual"))
            .select("id")
            .execute().value
        guard let entry = created.first else { return }
        await emit(
            .loggedTime,
            EventObject(.timeEntry, entry.id),
            target: await projectTarget(projectId),
            projectId: projectId,
            metadata: ["started_at": .text(iso(start)), "ended_at": .text(iso(end))]
        )
    }

    func deleteTimeEntry(id: String) async throws {
        struct Row: Decodable, Sendable { let project_id: String }
        let entry: Row? = await eventLookup(table: "time_entries", id: id, columns: "project_id")
        try await db.from("time_entries").delete().eq("id", value: id).execute()
        var target: EventObject?
        if let entry { target = await projectTarget(entry.project_id) }
        await emit(.deleted, EventObject(.timeEntry, id), target: target, projectId: entry?.project_id)
    }

    private struct TaskInsertPayload: Encodable {
        var project_id: String
        var ticket_num: Int
        var title: String
        var description: String?
        var priority: String
        var area: String
    }

    func createTask(projectId: String, title: String, description: String?, priority: TaskPriority, area: TaskArea) async throws {
        // Next ticket number per project (mirrors the web app's insert path).
        struct NumRow: Decodable { let ticket_num: Int }
        let existing: [NumRow] = try await db.from("tasks")
            .select("ticket_num")
            .eq("project_id", value: projectId)
            .order("ticket_num", ascending: false)
            .limit(1)
            .execute().value
        let next = (existing.first?.ticket_num ?? 0) + 1
        let created: [InsertedId] = try await db.from("tasks")
            .insert(TaskInsertPayload(project_id: projectId, ticket_num: next, title: title, description: description, priority: priority.rawValue, area: area.rawValue))
            .select("id")
            .execute().value
        guard let task = created.first else { return }
        await emit(
            .created,
            EventObject(.task, task.id, label: title),
            projectId: projectId,
            metadata: ["ticket_num": .number(next)]
        )
    }

    private struct TaskUpdatePayload: Encodable {
        var title: String
        var description: String?
        var priority: String
        var area: String
        var status: String
        var assignee: String?
        var claimed_by: String?
        var checklist: [ChecklistItem]
    }

    func updateTask(_ t: TaskItem) async throws {
        // Before-state, so a board move to "done" reads as `completed` and a
        // claim reads as `claimed` — see EventRules.taskUpdateVerb.
        let before: EventRules.TaskSnapshot? = await eventLookup(
            table: "tasks", id: t.id, columns: EventRules.TaskSnapshot.columns
        )
        try await db.from("tasks")
            .update(TaskUpdatePayload(title: t.title, description: t.description, priority: t.priority.rawValue, area: t.area.rawValue, status: t.status.rawValue, assignee: t.assignee, claimed_by: t.claimedBy, checklist: t.checklist))
            .eq("id", value: t.id)
            .execute()
        if let verb = EventRules.taskUpdateVerb(old: before, new: t) {
            await emit(verb, EventObject(.task, t.id, label: t.title), projectId: t.projectId)
        }
    }

    func deleteTask(id: String) async throws {
        struct Row: Decodable, Sendable {
            let title: String
            let project_id: String
        }
        let task: Row? = await eventLookup(table: "tasks", id: id, columns: "title, project_id")
        try await db.from("tasks").delete().eq("id", value: id).execute()
        await emit(.deleted, EventObject(.task, id, label: task?.title), projectId: task?.project_id)
    }

    private struct NotePayload: Encodable {
        var title: String
        var body: String
    }

    func createNote(title: String, body: String) async throws {
        let created: [InsertedId] = try await db.from("notes")
            .insert(NotePayload(title: title, body: body))
            .select("id")
            .execute().value
        guard let note = created.first else { return }
        // Notes have no project column — the web app emits no project scope here.
        await emit(.created, EventObject(.note, note.id, label: title))
    }

    func updateNote(_ n: Note) async throws {
        try await db.from("notes")
            .update(NotePayload(title: n.title, body: n.body))
            .eq("id", value: n.id)
            .execute()
        await emit(.updated, EventObject(.note, n.id, label: n.title))
    }

    func deleteNote(id: String) async throws {
        let title = await eventLabel(table: "notes", id: id, column: "title")
        try await db.from("notes").delete().eq("id", value: id).execute()
        await emit(.deleted, EventObject(.note, id, label: title))
    }

    private struct PromptPayload: Encodable {
        var title: String
        var prompt_text: String
        var response_notes: String?
        var ai_tool: String?
        var rating: Int?
        var project_id: String?
        var is_favorite: Bool
    }

    func createPrompt(title: String, text: String, responseNotes: String?, aiTool: String?, rating: Int?, projectId: String?) async throws {
        let created: [InsertedId] = try await db.from("prompts")
            .insert(PromptPayload(title: title, prompt_text: text, response_notes: responseNotes, ai_tool: aiTool, rating: rating, project_id: projectId, is_favorite: false))
            .select("id")
            .execute().value
        guard let prompt = created.first else { return }
        await emit(.created, EventObject(.prompt, prompt.id, label: title), projectId: projectId)
    }

    func updatePrompt(_ p: Prompt) async throws {
        // The star button and the edit form both land here; the before-state
        // tells them apart (`favorited` vs `updated`).
        let before: EventRules.PromptSnapshot? = await eventLookup(
            table: "prompts", id: p.id, columns: EventRules.PromptSnapshot.columns
        )
        try await db.from("prompts")
            .update(PromptPayload(title: p.title, prompt_text: p.promptText, response_notes: p.responseNotes, ai_tool: p.aiTool, rating: p.rating, project_id: p.projectId, is_favorite: p.isFavorite))
            .eq("id", value: p.id)
            .execute()
        if let verb = EventRules.promptUpdateVerb(old: before, new: p) {
            await emit(verb, EventObject(.prompt, p.id, label: p.title), projectId: p.projectId)
        }
    }

    func deletePrompt(id: String) async throws {
        let title = await eventLabel(table: "prompts", id: id, column: "title")
        try await db.from("prompts").delete().eq("id", value: id).execute()
        // No project scope: matches src/app/prompts/actions.ts deletePrompt.
        await emit(.deleted, EventObject(.prompt, id, label: title))
    }

    private struct KnowledgePayload: Encodable {
        var kind: String
        var title: String
        var description: String?
        var content: String?
        var url: String?
        var project_id: String?
    }

    func createKnowledgeItem(kind: KnowledgeKind, title: String, description: String?, content: String?, url: String?, projectId: String?) async throws {
        let created: [InsertedId] = try await db.from("knowledge_items")
            .insert(KnowledgePayload(kind: kind.rawValue, title: title, description: description, content: content, url: url, project_id: projectId))
            .select("id")
            .execute().value
        guard let item = created.first else { return }
        await emit(
            .created,
            EventObject(.knowledgeItem, item.id, label: title),
            projectId: projectId,
            metadata: ["kind": .text(kind.rawValue)]
        )
    }

    func updateKnowledgeItem(_ k: KnowledgeItem) async throws {
        try await db.from("knowledge_items")
            .update(KnowledgePayload(kind: k.kind.rawValue, title: k.title, description: k.description, content: k.content, url: k.url, project_id: k.projectId))
            .eq("id", value: k.id)
            .execute()
        await emit(
            .updated,
            EventObject(.knowledgeItem, k.id, label: k.title),
            projectId: k.projectId,
            metadata: ["kind": .text(k.kind.rawValue)]
        )
    }

    func deleteKnowledgeItem(id: String) async throws {
        struct Row: Decodable, Sendable {
            let title: String
            let kind: String
            let project_id: String?
        }
        let item: Row? = await eventLookup(table: "knowledge_items", id: id, columns: "title, kind, project_id")
        try await db.from("knowledge_items").delete().eq("id", value: id).execute()
        await emit(
            .deleted,
            EventObject(.knowledgeItem, id, label: item?.title),
            projectId: item?.project_id,
            metadata: item.map { ["kind": EventMetaValue.text($0.kind)] } ?? [:]
        )
    }

    private struct AgentPayload: Encodable {
        var name: String
        var description: String?
        var system_prompt: String?
        var model: String?
        var tools: [String]
        var status: String
        var project_id: String?
    }

    func createAgent(name: String, description: String?, systemPrompt: String?, model: String?, tools: [String], projectId: String?) async throws {
        let created: [InsertedId] = try await db.from("agents")
            .insert(AgentPayload(name: name, description: description, system_prompt: systemPrompt, model: model, tools: tools, status: "active", project_id: projectId))
            .select("id")
            .execute().value
        guard let agent = created.first else { return }
        await emit(.created, EventObject(.agent, agent.id, label: name), projectId: projectId)
    }

    func updateAgent(_ a: Agent) async throws {
        try await db.from("agents")
            .update(AgentPayload(name: a.name, description: a.description, system_prompt: a.systemPrompt, model: a.model, tools: a.tools, status: a.status.rawValue, project_id: a.projectId))
            .eq("id", value: a.id)
            .execute()
        await emit(.updated, EventObject(.agent, a.id, label: a.name), projectId: a.projectId)
    }

    func deleteAgent(id: String) async throws {
        let name = await eventLabel(table: "agents", id: id, column: "name")
        try await db.from("agents").delete().eq("id", value: id).execute()
        // No project scope: matches src/app/agents/actions.ts deleteAgent.
        await emit(.deleted, EventObject(.agent, id, label: name))
    }

    private struct IdeaPayload: Encodable {
        var title: String
        var tagline: String?
        var problem: String?
        var customer: String?
        var solution: String?
        var revenue_model: String?
        var stack_notes: String?
        var verdict: String?
        var status: String
        var scores: [String: Int]
        var source_url: String?
    }

    func createIdea(title: String, tagline: String?) async throws {
        let created: [InsertedId] = try await db.from("ideas")
            .insert(IdeaPayload(title: title, tagline: tagline, problem: nil, customer: nil, solution: nil, revenue_model: nil, stack_notes: nil, verdict: nil, status: "draft", scores: [:], source_url: nil))
            .select("id")
            .execute().value
        guard let idea = created.first else { return }
        await emit(.created, EventObject(.idea, idea.id, label: title))
    }

    func updateIdea(_ i: Idea) async throws {
        // Content edits are `updated`; inline verdict/status/score changes are
        // the web app's patchIdea, which emits nothing.
        let before: EventRules.IdeaSnapshot? = await eventLookup(
            table: "ideas", id: i.id, columns: EventRules.IdeaSnapshot.columns
        )
        try await db.from("ideas")
            .update(IdeaPayload(title: i.title, tagline: i.tagline, problem: i.problem, customer: i.customer, solution: i.solution, revenue_model: i.revenueModel, stack_notes: i.stackNotes, verdict: i.verdict?.rawValue, status: i.status.rawValue, scores: i.scores, source_url: i.sourceUrl))
            .eq("id", value: i.id)
            .execute()
        if let verb = EventRules.ideaUpdateVerb(old: before, new: i) {
            await emit(verb, EventObject(.idea, i.id, label: i.title))
        }
    }

    func deleteIdea(id: String) async throws {
        let title = await eventLabel(table: "ideas", id: id, column: "title")
        try await db.from("ideas").delete().eq("id", value: id).execute()
        await emit(.deleted, EventObject(.idea, id, label: title))
    }

    func setStep(stepId: String, complete: Bool) async throws {
        guard let uid = await currentUserId() else { return }
        if complete {
            // Plain insert rather than upsert, matching the web app: the
            // `unique (user_id, step_id)` index (0005_academy.sql) is then the
            // sole arbiter of "was this already ticked", so two fast taps can't
            // both decide it's new and append two `completed` rows to a log with
            // no delete policy. 23505 is swallowed exactly as the web does, so
            // completing stays idempotent for the user — only the event is
            // skipped. Any other error propagates, as before.
            do {
                try await db.from("academy_step_progress")
                    .insert(["step_id": stepId, "user_id": uid])
                    .execute()
            } catch let error as PostgrestError where error.code == "23505" {
                return
            }
            // The feed tracks module progress, not individual steps — the step
            // rides along in metadata (src/app/academy/actions.ts).
            struct StepRow: Decodable, Sendable { let module_id: String }
            if let step: StepRow = await eventLookup(table: "academy_steps", id: stepId, columns: "module_id") {
                let title = await eventLabel(table: "academy_modules", id: step.module_id, column: "title")
                await emit(
                    .completed,
                    EventObject(.academyModule, step.module_id, label: title),
                    metadata: ["step_id": .text(stepId)]
                )
            }
        } else {
            try await db.from("academy_step_progress")
                .delete()
                .eq("step_id", value: stepId)
                .eq("user_id", value: uid)
                .execute()
            // Un-completing is silent, same as the web app.
        }
    }

    private struct AssessmentPayload: Encodable {
        var user_id: String
        var outcome_id: String
        var rating: Int
        var confidence: Int?
        var note: String?
    }

    func upsertAssessment(outcomeId: String, rating: Int, confidence: Int?, note: String?) async throws {
        guard let uid = await currentUserId() else { return }
        try await db.from("academy_outcome_assessments")
            .upsert(AssessmentPayload(user_id: uid, outcome_id: outcomeId, rating: rating, confidence: confidence, note: note), onConflict: "user_id,outcome_id")
            .execute()
        let name = await eventLabel(table: "academy_outcomes", id: outcomeId, column: "name")
        await emit(
            .rated,
            EventObject(.academyOutcome, outcomeId, label: name),
            metadata: ["rating": .number(rating)]
        )
    }

    // MARK: search (ilike across the same fields the web app's tsvector covers)

    func search(_ query: String) async throws -> [SearchHit] {
        let pattern = "%\(query)%"
        async let projects: [Project] = db.from("projects").select().ilike("name", pattern: pattern).limit(10).execute().value
        async let notes: [Note] = db.from("notes").select().ilike("title", pattern: pattern).limit(10).execute().value
        async let prompts: [Prompt] = db.from("prompts").select().ilike("title", pattern: pattern).limit(10).execute().value
        async let knowledge: [KnowledgeItem] = db.from("knowledge_items").select().ilike("title", pattern: pattern).limit(10).execute().value
        async let ideas: [Idea] = db.from("ideas").select().ilike("title", pattern: pattern).limit(10).execute().value
        async let tasks: [TaskItem] = db.from("tasks").select().ilike("title", pattern: pattern).limit(10).execute().value
        async let agents: [Agent] = db.from("agents").select().ilike("name", pattern: pattern).limit(10).execute().value

        var hits: [SearchHit] = []
        hits += try await projects.map { SearchHit(id: $0.id, kind: .project, title: $0.name, subtitle: $0.status.rawValue) }
        hits += try await notes.map { SearchHit(id: $0.id, kind: .note, title: $0.title, subtitle: "note") }
        hits += try await prompts.map { SearchHit(id: $0.id, kind: .prompt, title: $0.title, subtitle: $0.aiTool ?? "prompt") }
        hits += try await knowledge.map { SearchHit(id: $0.id, kind: .knowledge, title: $0.title, subtitle: $0.kind.label) }
        hits += try await ideas.map { SearchHit(id: $0.id, kind: .idea, title: $0.title, subtitle: $0.status.rawValue) }
        hits += try await tasks.map { SearchHit(id: $0.id, kind: .task, title: $0.title, subtitle: $0.status.label) }
        hits += try await agents.map { SearchHit(id: $0.id, kind: .agent, title: $0.name, subtitle: $0.model ?? "agent") }
        return hits
    }
}
