import Foundation

// In-memory backend with realistic seed data. Lets anyone explore the app
// (and lets CI/screenshots run) without a Supabase project. Mutations work
// for the session and vanish on quit — mirrors the web PR's demo mode.

actor DemoStore {
    static let lukeId = "00000000-0000-0000-0000-000000000001"
    static let johnId = "00000000-0000-0000-0000-000000000002"
    static let brainProjectId = "10000000-0000-0000-0000-000000000001"
    static let startupProjectId = "10000000-0000-0000-0000-000000000002"
    static let researchProjectId = "10000000-0000-0000-0000-000000000003"

    var profiles: [Profile]
    var projects: [Project]
    var entries: [TimeEntry]
    var taskItems: [TaskItem]
    var noteItems: [Note]
    var promptItems: [Prompt]
    var knowledge: [KnowledgeItem]
    var agentItems: [Agent]
    var ideaItems: [Idea]
    var modules: [AcademyModule]
    var steps: [AcademyStep]
    var progress: [StepProgress]
    var outcomeItems: [AcademyOutcome]
    var assessmentItems: [OutcomeAssessment]
    var linkItems: [EntityLink]

    init() {
        let now = Date()
        func ago(_ hours: Double) -> String { iso(now.addingTimeInterval(-hours * 3600)) }
        func day(_ d: Int, _ h: Double) -> String {
            iso(Calendar.current.date(byAdding: .day, value: -d, to: now)!.addingTimeInterval(-h * 3600))
        }

        profiles = [
            Profile(id: Self.lukeId, email: "lukebmoffat@gmail.com", fullName: "Luke Moffat", avatarUrl: nil),
            Profile(id: Self.johnId, email: "jwmilius@gmail.com", fullName: "John Milius", avatarUrl: nil),
        ]

        projects = [
            Project(id: Self.brainProjectId, name: "Sandbox Brain", description: "The team hub itself — Next.js + Supabase.", status: .active, startedOn: nil, endedOn: nil, ticketPrefix: "SB", createdBy: Self.johnId, createdAt: day(30, 0), updatedAt: ago(3)),
            Project(id: Self.startupProjectId, name: "First attempt startup", description: "Validating the first product idea.", status: .active, startedOn: nil, endedOn: nil, ticketPrefix: "FA", createdBy: Self.johnId, createdAt: day(21, 0), updatedAt: ago(26)),
            Project(id: Self.researchProjectId, name: "Market research", description: "Customer discovery interviews and market sizing.", status: .paused, startedOn: nil, endedOn: nil, ticketPrefix: "MR", createdBy: Self.lukeId, createdAt: day(14, 0), updatedAt: day(2, 1)),
        ]

        entries = [
            // John's running timer (started ~1h ago).
            TimeEntry(id: UUID().uuidString.lowercased(), userId: Self.johnId, projectId: Self.brainProjectId, startedAt: ago(1.1), endedAt: nil, notes: "Reviewing the dashboard PR", source: .timer),
            TimeEntry(id: UUID().uuidString.lowercased(), userId: Self.lukeId, projectId: Self.brainProjectId, startedAt: day(0, 6), endedAt: day(0, 3.5), notes: "MCP app polish", source: .timer),
            TimeEntry(id: UUID().uuidString.lowercased(), userId: Self.lukeId, projectId: Self.brainProjectId, startedAt: day(1, 8), endedAt: day(1, 5.5), notes: "V2 restyle", source: .timer),
            TimeEntry(id: UUID().uuidString.lowercased(), userId: Self.johnId, projectId: Self.startupProjectId, startedAt: day(1, 7), endedAt: day(1, 4), notes: "Landing page copy", source: .manual),
            TimeEntry(id: UUID().uuidString.lowercased(), userId: Self.lukeId, projectId: Self.brainProjectId, startedAt: day(2, 9), endedAt: day(2, 7), notes: nil, source: .timer),
            TimeEntry(id: UUID().uuidString.lowercased(), userId: Self.lukeId, projectId: Self.startupProjectId, startedAt: day(3, 6), endedAt: day(3, 4), notes: "Pitch deck", source: .manual),
            TimeEntry(id: UUID().uuidString.lowercased(), userId: Self.johnId, projectId: Self.researchProjectId, startedAt: day(3, 9), endedAt: day(3, 7.5), notes: "Interview #4", source: .timer),
            TimeEntry(id: UUID().uuidString.lowercased(), userId: Self.lukeId, projectId: Self.researchProjectId, startedAt: day(4, 5), endedAt: day(4, 3.5), notes: "Interview #3 notes", source: .manual),
            TimeEntry(id: UUID().uuidString.lowercased(), userId: Self.johnId, projectId: Self.brainProjectId, startedAt: day(5, 8), endedAt: day(5, 6.2), notes: "Schema work", source: .timer),
        ]

        taskItems = [
            TaskItem(id: UUID().uuidString.lowercased(), projectId: Self.brainProjectId, ticketNum: 12, title: "Ship the macOS app", description: "Native SwiftUI port with Liquid Glass.", priority: .high, area: .frontend, status: .inprogress, assignee: Self.lukeId, claimedBy: Self.lukeId, checklist: [ChecklistItem(text: "Onboarding flow", done: true), ChecklistItem(text: "Dashboard", done: false)], createdBy: Self.lukeId, createdAt: day(1, 3), updatedAt: ago(2)),
            TaskItem(id: UUID().uuidString.lowercased(), projectId: Self.brainProjectId, ticketNum: 11, title: "Review MCP dashboard PR", description: nil, priority: .med, area: .frontend, status: .review, assignee: Self.johnId, claimedBy: Self.johnId, checklist: [], createdBy: Self.lukeId, createdAt: day(2, 2), updatedAt: ago(26)),
            TaskItem(id: UUID().uuidString.lowercased(), projectId: Self.startupProjectId, ticketNum: 3, title: "Draft landing page", description: "Hero, pricing, waitlist form.", priority: .high, area: .design, status: .todo, assignee: nil, claimedBy: nil, checklist: [], createdBy: Self.johnId, createdAt: day(3, 1), updatedAt: day(2, 5)),
            TaskItem(id: UUID().uuidString.lowercased(), projectId: Self.startupProjectId, ticketNum: 2, title: "Set up analytics", description: nil, priority: .low, area: .backend, status: .backlog, assignee: nil, claimedBy: nil, checklist: [], createdBy: Self.johnId, createdAt: day(4, 2), updatedAt: day(4, 2)),
            TaskItem(id: UUID().uuidString.lowercased(), projectId: Self.brainProjectId, ticketNum: 10, title: "Seed academy modules", description: nil, priority: .med, area: .backend, status: .done, assignee: Self.johnId, claimedBy: Self.johnId, checklist: [], createdBy: Self.johnId, createdAt: day(6, 4), updatedAt: day(5, 2)),
        ]

        noteItems = [
            Note(id: UUID().uuidString.lowercased(), authorId: Self.lukeId, title: "Interview #3 — college landlord", body: "Pain points:\n- Tracking rent payments in spreadsheets\n- Maintenance requests over text\n\nRelated: [[Market sizing]] and [[First attempt startup]].", createdAt: day(4, 3), updatedAt: ago(5)),
            Note(id: UUID().uuidString.lowercased(), authorId: Self.johnId, title: "Market sizing", body: "TAM ~$2.1B for small-landlord software in the US.\n\nSee [[Interview #3 — college landlord]].", createdAt: day(6, 2), updatedAt: day(1, 4)),
            Note(id: UUID().uuidString.lowercased(), authorId: Self.johnId, title: "Team working agreement", body: "- Standup Mon/Wed 9am\n- PRs need one review\n- Track all hours in Time", createdAt: day(20, 0), updatedAt: day(20, 0)),
        ]

        promptItems = [
            Prompt(id: UUID().uuidString.lowercased(), userId: Self.lukeId, projectId: Self.brainProjectId, title: "V2 design system restyle", promptText: "Restyle this component to match the v2 design spec: cream background #faf9f7, Newsreader serif headings…", responseNotes: "Nailed it first try with the spec pasted in.", aiTool: "claude-code", rating: 5, isFavorite: true, createdAt: day(2, 6), updatedAt: ago(30)),
            Prompt(id: UUID().uuidString.lowercased(), userId: Self.johnId, projectId: Self.startupProjectId, title: "Customer interview script", promptText: "Write a 20-minute customer discovery interview script for small landlords…", responseNotes: nil, aiTool: "claude", rating: 4, isFavorite: false, createdAt: day(5, 3), updatedAt: day(5, 3)),
            Prompt(id: UUID().uuidString.lowercased(), userId: Self.lukeId, projectId: nil, title: "Commit message style", promptText: "Write conventional commit messages, imperative mood, no trailers.", responseNotes: "Team canonical.", aiTool: "claude-code", rating: 5, isFavorite: true, createdAt: day(8, 1), updatedAt: day(8, 1)),
        ]

        knowledge = [
            KnowledgeItem(id: UUID().uuidString.lowercased(), kind: .decision, title: "Supabase over Firebase", description: "Postgres + RLS beats Firestore for our relational data.", content: "Decided 2026-06: relational schema, SQL familiarity (Luke), RLS for the allowlist gate.", url: nil, projectId: Self.brainProjectId, createdBy: Self.johnId, createdAt: day(25, 0), updatedAt: day(25, 0)),
            KnowledgeItem(id: UUID().uuidString.lowercased(), kind: .codeSnippet, title: "RLS team gate", description: "The is_team_member() pattern every table uses.", content: "create policy \"team full access\" on t for all to authenticated using (public.is_team_member());", url: nil, projectId: Self.brainProjectId, createdBy: Self.lukeId, createdAt: day(24, 0), updatedAt: day(10, 0)),
            KnowledgeItem(id: UUID().uuidString.lowercased(), kind: .contact, title: "Prof. Hansen — Sandbox mentor", description: "Office hours Tuesdays. Intro'd us to two landlords for interviews.", content: nil, url: nil, projectId: Self.researchProjectId, createdBy: Self.johnId, createdAt: day(12, 0), updatedAt: day(12, 0)),
        ]

        agentItems = [
            Agent(id: UUID().uuidString.lowercased(), name: "PR Reviewer", description: "Reviews team PRs against the v2 design spec.", systemPrompt: "You are a strict reviewer. Check DESIGN-SPEC.md tokens…", model: "claude-opus-4-8", tools: ["read", "grep"], status: .active, projectId: Self.brainProjectId, createdBy: Self.lukeId, createdAt: day(9, 0), updatedAt: day(9, 0)),
            Agent(id: UUID().uuidString.lowercased(), name: "Interview Summarizer", description: "Turns raw interview notes into structured insights.", systemPrompt: "Extract pains, gains, quotes…", model: "claude-sonnet-5", tools: [], status: .active, projectId: Self.researchProjectId, createdBy: Self.johnId, createdAt: day(11, 0), updatedAt: day(6, 0)),
        ]

        ideaItems = [
            Idea(id: UUID().uuidString.lowercased(), title: "LandlordOS", tagline: "Rent + maintenance for small landlords", problem: "Small landlords run on spreadsheets and texts.", customer: "Landlords with 2–20 units near campuses", solution: "One dashboard: rent tracking, maintenance queue, tenant chat.", revenueModel: "$29/mo per landlord", stackNotes: "Next.js + Supabase, Stripe billing", verdict: .strong, status: .validating, scores: ["problem": 8, "market": 7, "revenue": 6, "build": 8], sourceUrl: nil, promotedProjectId: nil, createdBy: Self.johnId, createdAt: day(13, 0), updatedAt: ago(50)),
            Idea(id: UUID().uuidString.lowercased(), title: "Campus meal-swap marketplace", tagline: "Trade unused dining-hall swipes", problem: "Meal plans expire unused.", customer: "Students on mandatory meal plans", solution: "P2P swipe marketplace.", revenueModel: "Take rate on trades", stackNotes: nil, verdict: .pass, status: .archived, scores: ["problem": 5, "market": 4], sourceUrl: nil, promotedProjectId: nil, createdBy: Self.lukeId, createdAt: day(18, 0), updatedAt: day(15, 0)),
        ]

        let moduleId1 = UUID().uuidString.lowercased()
        let moduleId2 = UUID().uuidString.lowercased()
        modules = [
            AcademyModule(id: moduleId1, slug: "customer-discovery", title: "Customer Discovery", description: "Find and interview your first users.", kind: "course", sortOrder: 1),
            AcademyModule(id: moduleId2, slug: "mvp-in-a-week", title: "MVP in a Week", description: "Scope, build, and ship a first cut.", kind: "workshop", sortOrder: 2),
        ]
        let step1 = UUID().uuidString.lowercased()
        let step2 = UUID().uuidString.lowercased()
        steps = [
            AcademyStep(id: step1, moduleId: moduleId1, stepNo: 1, title: "Draft your interview script", promptText: "Write a 20-minute discovery script for your target customer…", stepType: "chat"),
            AcademyStep(id: step2, moduleId: moduleId1, stepNo: 2, title: "Run 3 interviews", promptText: "Summarize each interview: pains, gains, quotes.", stepType: "chat"),
            AcademyStep(id: UUID().uuidString.lowercased(), moduleId: moduleId2, stepNo: 1, title: "Scope the MVP", promptText: "List the ONE core loop. Cut everything else.", stepType: "coding_agent"),
        ]
        progress = [
            StepProgress(id: UUID().uuidString.lowercased(), userId: Self.lukeId, stepId: step1, completedAt: day(7, 0)),
            StepProgress(id: UUID().uuidString.lowercased(), userId: Self.johnId, stepId: step1, completedAt: day(8, 0)),
            StepProgress(id: UUID().uuidString.lowercased(), userId: Self.johnId, stepId: step2, completedAt: day(4, 0)),
        ]
        let outcome1 = UUID().uuidString.lowercased()
        let outcome2 = UUID().uuidString.lowercased()
        outcomeItems = [
            AcademyOutcome(id: outcome1, slug: "customer-empathy", name: "Customer empathy", description: "Can run discovery interviews and extract real pains.", sortOrder: 1),
            AcademyOutcome(id: outcome2, slug: "rapid-prototyping", name: "Rapid prototyping", description: "Can ship a testable MVP in days.", sortOrder: 2),
        ]
        assessmentItems = [
            OutcomeAssessment(id: UUID().uuidString.lowercased(), userId: Self.lukeId, outcomeId: outcome2, rating: 3, confidence: 4, note: "Shipped 5 sprint projects this semester."),
            OutcomeAssessment(id: UUID().uuidString.lowercased(), userId: Self.johnId, outcomeId: outcome1, rating: 3, confidence: 3, note: nil),
        ]

        linkItems = [
            EntityLink(id: UUID().uuidString.lowercased(), sourceType: "note", sourceId: noteItems[0].id, targetType: "note", targetId: noteItems[1].id, relationship: "related"),
            EntityLink(id: UUID().uuidString.lowercased(), sourceType: "note", sourceId: noteItems[0].id, targetType: "project", targetId: Self.startupProjectId, relationship: "related"),
            EntityLink(id: UUID().uuidString.lowercased(), sourceType: "prompt", sourceId: promptItems[0].id, targetType: "project", targetId: Self.brainProjectId, relationship: "related"),
            EntityLink(id: UUID().uuidString.lowercased(), sourceType: "knowledge_item", sourceId: knowledge[0].id, targetType: "project", targetId: Self.brainProjectId, relationship: "related"),
            EntityLink(id: UUID().uuidString.lowercased(), sourceType: "idea", sourceId: ideaItems[0].id, targetType: "project", targetId: Self.researchProjectId, relationship: "related"),
        ]
    }

    // Generic mutation helpers keep the protocol conformance below tiny.
    func mutateEntries(_ f: (inout [TimeEntry]) -> Void) { f(&entries) }
    func mutateProjects(_ f: (inout [Project]) -> Void) { f(&projects) }
    func mutateTasks(_ f: (inout [TaskItem]) -> Void) { f(&taskItems) }
    func mutateNotes(_ f: (inout [Note]) -> Void) { f(&noteItems) }
    func mutatePrompts(_ f: (inout [Prompt]) -> Void) { f(&promptItems) }
    func mutateKnowledge(_ f: (inout [KnowledgeItem]) -> Void) { f(&knowledge) }
    func mutateAgents(_ f: (inout [Agent]) -> Void) { f(&agentItems) }
    func mutateIdeas(_ f: (inout [Idea]) -> Void) { f(&ideaItems) }
    func mutateProgress(_ f: (inout [StepProgress]) -> Void) { f(&progress) }
    func mutateAssessments(_ f: (inout [OutcomeAssessment]) -> Void) { f(&assessmentItems) }
}

final class DemoBackend: BrainBackend {
    private let store = DemoStore()

    func currentUserId() async -> String? { DemoStore.lukeId }
    func isTeamMember() async throws -> Bool { true }
    func signOut() async {}

    func profiles() async throws -> [Profile] { await store.profiles }
    func projects() async throws -> [Project] { await store.projects }
    func timeEntries(since: Date?) async throws -> [TimeEntry] {
        let all = await store.entries
        guard let since else { return all }
        return all.filter { $0.isRunning || parseISO($0.startedAt) >= since }
    }
    func tasks() async throws -> [TaskItem] { await store.taskItems }
    func notes() async throws -> [Note] { await store.noteItems }
    func prompts() async throws -> [Prompt] { await store.promptItems }
    func knowledgeItems() async throws -> [KnowledgeItem] { await store.knowledge }
    func agents() async throws -> [Agent] { await store.agentItems }
    func ideas() async throws -> [Idea] { await store.ideaItems }
    func academyModules() async throws -> [AcademyModule] { await store.modules }
    func academySteps() async throws -> [AcademyStep] { await store.steps }
    func stepProgress() async throws -> [StepProgress] { await store.progress }
    func outcomes() async throws -> [AcademyOutcome] { await store.outcomeItems }
    func assessments() async throws -> [OutcomeAssessment] { await store.assessmentItems }
    func links() async throws -> [EntityLink] { await store.linkItems }

    func createProject(name: String, description: String?, status: ProjectStatus) async throws {
        let p = Project(id: UUID().uuidString.lowercased(), name: name, description: description, status: status, startedOn: nil, endedOn: nil, ticketPrefix: nil, createdBy: DemoStore.lukeId, createdAt: isoNow(), updatedAt: isoNow())
        await store.mutateProjects { $0.insert(p, at: 0) }
    }
    func updateProject(_ p: Project) async throws {
        await store.mutateProjects { list in
            if let i = list.firstIndex(where: { $0.id == p.id }) { list[i] = p }
        }
    }
    func deleteProject(id: String) async throws {
        await store.mutateProjects { $0.removeAll { $0.id == id } }
    }

    func startTimer(projectId: String, notes: String?) async throws {
        let uid = DemoStore.lukeId
        let e = TimeEntry(id: UUID().uuidString.lowercased(), userId: uid, projectId: projectId, startedAt: isoNow(), endedAt: nil, notes: notes, source: .timer)
        await store.mutateEntries { list in
            // one running timer per person
            for i in list.indices where list[i].userId == uid && list[i].isRunning {
                list[i].endedAt = isoNow()
            }
            list.insert(e, at: 0)
        }
    }
    func stopTimer(entryId: String) async throws {
        await store.mutateEntries { list in
            if let i = list.firstIndex(where: { $0.id == entryId }) { list[i].endedAt = isoNow() }
        }
    }
    func addManualEntry(projectId: String, start: Date, end: Date, notes: String?) async throws {
        let e = TimeEntry(id: UUID().uuidString.lowercased(), userId: DemoStore.lukeId, projectId: projectId, startedAt: iso(start), endedAt: iso(end), notes: notes, source: .manual)
        await store.mutateEntries { $0.insert(e, at: 0) }
    }
    func deleteTimeEntry(id: String) async throws {
        await store.mutateEntries { $0.removeAll { $0.id == id } }
    }

    func createTask(projectId: String, title: String, description: String?, priority: TaskPriority, area: TaskArea) async throws {
        let existing = await store.taskItems.filter { $0.projectId == projectId }.map(\.ticketNum).max() ?? 0
        let t = TaskItem(id: UUID().uuidString.lowercased(), projectId: projectId, ticketNum: existing + 1, title: title, description: description, priority: priority, area: area, status: .backlog, assignee: nil, claimedBy: nil, checklist: [], createdBy: DemoStore.lukeId, createdAt: isoNow(), updatedAt: isoNow())
        await store.mutateTasks { $0.insert(t, at: 0) }
    }
    func updateTask(_ t: TaskItem) async throws {
        var updated = t
        updated.updatedAt = isoNow()
        await store.mutateTasks { list in
            if let i = list.firstIndex(where: { $0.id == t.id }) { list[i] = updated }
        }
    }
    func deleteTask(id: String) async throws {
        await store.mutateTasks { $0.removeAll { $0.id == id } }
    }

    func createNote(title: String, body: String) async throws {
        let n = Note(id: UUID().uuidString.lowercased(), authorId: DemoStore.lukeId, title: title, body: body, createdAt: isoNow(), updatedAt: isoNow())
        await store.mutateNotes { $0.insert(n, at: 0) }
    }
    func updateNote(_ n: Note) async throws {
        var updated = n
        updated.updatedAt = isoNow()
        await store.mutateNotes { list in
            if let i = list.firstIndex(where: { $0.id == n.id }) { list[i] = updated }
        }
    }
    func deleteNote(id: String) async throws {
        await store.mutateNotes { $0.removeAll { $0.id == id } }
    }

    func createPrompt(title: String, text: String, responseNotes: String?, aiTool: String?, rating: Int?, projectId: String?) async throws {
        let p = Prompt(id: UUID().uuidString.lowercased(), userId: DemoStore.lukeId, projectId: projectId, title: title, promptText: text, responseNotes: responseNotes, aiTool: aiTool, rating: rating, isFavorite: false, createdAt: isoNow(), updatedAt: isoNow())
        await store.mutatePrompts { $0.insert(p, at: 0) }
    }
    func updatePrompt(_ p: Prompt) async throws {
        await store.mutatePrompts { list in
            if let i = list.firstIndex(where: { $0.id == p.id }) { list[i] = p }
        }
    }
    func deletePrompt(id: String) async throws {
        await store.mutatePrompts { $0.removeAll { $0.id == id } }
    }

    func createKnowledgeItem(kind: KnowledgeKind, title: String, description: String?, content: String?, url: String?, projectId: String?) async throws {
        let k = KnowledgeItem(id: UUID().uuidString.lowercased(), kind: kind, title: title, description: description, content: content, url: url, projectId: projectId, createdBy: DemoStore.lukeId, createdAt: isoNow(), updatedAt: isoNow())
        await store.mutateKnowledge { $0.insert(k, at: 0) }
    }
    func updateKnowledgeItem(_ k: KnowledgeItem) async throws {
        await store.mutateKnowledge { list in
            if let i = list.firstIndex(where: { $0.id == k.id }) { list[i] = k }
        }
    }
    func deleteKnowledgeItem(id: String) async throws {
        await store.mutateKnowledge { $0.removeAll { $0.id == id } }
    }

    func createAgent(name: String, description: String?, systemPrompt: String?, model: String?, tools: [String], projectId: String?) async throws {
        let a = Agent(id: UUID().uuidString.lowercased(), name: name, description: description, systemPrompt: systemPrompt, model: model, tools: tools, status: .active, projectId: projectId, createdBy: DemoStore.lukeId, createdAt: isoNow(), updatedAt: isoNow())
        await store.mutateAgents { $0.insert(a, at: 0) }
    }
    func updateAgent(_ a: Agent) async throws {
        await store.mutateAgents { list in
            if let i = list.firstIndex(where: { $0.id == a.id }) { list[i] = a }
        }
    }
    func deleteAgent(id: String) async throws {
        await store.mutateAgents { $0.removeAll { $0.id == id } }
    }

    func createIdea(title: String, tagline: String?) async throws {
        let i = Idea(id: UUID().uuidString.lowercased(), title: title, tagline: tagline, problem: nil, customer: nil, solution: nil, revenueModel: nil, stackNotes: nil, verdict: nil, status: .draft, scores: [:], sourceUrl: nil, promotedProjectId: nil, createdBy: DemoStore.lukeId, createdAt: isoNow(), updatedAt: isoNow())
        await store.mutateIdeas { $0.insert(i, at: 0) }
    }
    func updateIdea(_ i: Idea) async throws {
        var updated = i
        updated.updatedAt = isoNow()
        await store.mutateIdeas { list in
            if let idx = list.firstIndex(where: { $0.id == i.id }) { list[idx] = updated }
        }
    }
    func deleteIdea(id: String) async throws {
        await store.mutateIdeas { $0.removeAll { $0.id == id } }
    }

    func setStep(stepId: String, complete: Bool) async throws {
        let uid = DemoStore.lukeId
        await store.mutateProgress { list in
            list.removeAll { $0.stepId == stepId && $0.userId == uid }
            if complete {
                list.append(StepProgress(id: UUID().uuidString.lowercased(), userId: uid, stepId: stepId, completedAt: isoNow()))
            }
        }
    }

    func upsertAssessment(outcomeId: String, rating: Int, confidence: Int?, note: String?) async throws {
        let uid = DemoStore.lukeId
        await store.mutateAssessments { list in
            list.removeAll { $0.outcomeId == outcomeId && $0.userId == uid }
            list.append(OutcomeAssessment(id: UUID().uuidString.lowercased(), userId: uid, outcomeId: outcomeId, rating: rating, confidence: confidence, note: note))
        }
    }

    func search(_ query: String) async throws -> [SearchHit] {
        let q = query.lowercased()
        var hits: [SearchHit] = []
        hits += await store.projects.filter { $0.name.lowercased().contains(q) }.map { SearchHit(id: $0.id, kind: .project, title: $0.name, subtitle: $0.status.rawValue) }
        hits += await store.noteItems.filter { $0.title.lowercased().contains(q) || $0.body.lowercased().contains(q) }.map { SearchHit(id: $0.id, kind: .note, title: $0.title, subtitle: "note") }
        hits += await store.promptItems.filter { $0.title.lowercased().contains(q) || $0.promptText.lowercased().contains(q) }.map { SearchHit(id: $0.id, kind: .prompt, title: $0.title, subtitle: $0.aiTool ?? "prompt") }
        hits += await store.knowledge.filter { $0.title.lowercased().contains(q) }.map { SearchHit(id: $0.id, kind: .knowledge, title: $0.title, subtitle: $0.kind.label) }
        hits += await store.ideaItems.filter { $0.title.lowercased().contains(q) }.map { SearchHit(id: $0.id, kind: .idea, title: $0.title, subtitle: $0.status.rawValue) }
        hits += await store.taskItems.filter { $0.title.lowercased().contains(q) }.map { SearchHit(id: $0.id, kind: .task, title: $0.title, subtitle: $0.status.label) }
        hits += await store.agentItems.filter { $0.name.lowercased().contains(q) }.map { SearchHit(id: $0.id, kind: .agent, title: $0.name, subtitle: $0.model ?? "agent") }
        return hits
    }
}
