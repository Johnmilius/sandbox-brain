import Foundation
import Testing

@testable import SandboxBrainKit

// The events timeline port (Events.swift ← packages/core/src/events.ts).
// Everything here is pure: row construction and the verb-selection rules that
// reproduce the web app's narrow server actions. No database is touched — the
// live insert is verified by hand against src/app/*/actions.ts, deliberately
// never against the team's production feed.

@Suite struct EventsTests {

    // MARK: vocabulary
    //
    // These raw values are contracts: `verb` is matched by the web feed's
    // renderer, and `object_type` is an FK into public.object_types, so a typo
    // becomes a foreign-key failure at runtime.

    @Test func verbsMatchTheCoreVocabulary() {
        // EVENT_VERBS in packages/core/src/events.ts, in order.
        let expected = [
            "created", "updated", "deleted", "completed", "started", "stopped",
            "logged_time", "linked", "rated", "favorited", "promoted", "claimed", "ingested",
        ]
        #expect(EventVerb.allCases.map(\.rawValue) == expected)
    }

    @Test func objectTypesMatchTheRegistry() {
        // The rows seeded by supabase/migrations/0008_object_registry.sql.
        let expected: Set<String> = [
            "project", "note", "prompt", "knowledge_item", "profile", "time_entry",
            "agent", "academy_module", "academy_outcome", "idea", "task",
        ]
        #expect(Set(EventObjectType.allCases.map(\.rawValue)) == expected)
    }

    // MARK: row construction

    @Test func rowFlattensObjectTargetAndProject() {
        let row = EventRow(EventInput(
            verb: .loggedTime,
            object: EventObject(.timeEntry, "e1"),
            target: EventObject(.project, "p1", label: "Sandbox Brain"),
            projectId: "p1",
            metadata: ["started_at": .text("2026-07-29T10:00:00Z")]
        ))
        #expect(row.verb == "logged_time")
        #expect(row.object_type == "time_entry")
        #expect(row.object_id == "e1")
        #expect(row.object_label == nil)
        #expect(row.target_type == "project")
        #expect(row.target_id == "p1")
        #expect(row.target_label == "Sandbox Brain")
        #expect(row.project_id == "p1")
        #expect(row.metadata == ["started_at": .text("2026-07-29T10:00:00Z")])
    }

    @Test func rowAlwaysDeclaresTheAppSource() {
        // events.source is checked against ('app','mcp','connector'); the Swift
        // apps are always 'app'.
        let row = EventRow(EventInput(verb: .created, object: EventObject(.note, "n1", label: "Hi")))
        #expect(row.source == "app")
    }

    /// The RLS insert policy is `is_team_member() and actor_id = auth.uid()`,
    /// and the column defaults to auth.uid() — so the payload must never carry
    /// an actor_id, and nil columns must be omitted rather than sent as null.
    @Test func encodedPayloadOmitsActorIdAndEmptyColumns() throws {
        let row = EventRow(EventInput(verb: .created, object: EventObject(.idea, "i1", label: "LandlordOS")))
        let data = try JSONEncoder().encode(row)
        let json = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])

        #expect(json["actor_id"] == nil)
        #expect(json["target_type"] == nil)
        #expect(json["target_id"] == nil)
        #expect(json["project_id"] == nil)
        #expect(json["verb"] as? String == "created")
        #expect(json["object_type"] as? String == "idea")
        #expect(json["object_label"] as? String == "LandlordOS")
        #expect(json["source"] as? String == "app")
        #expect((json["metadata"] as? [String: Any])?.isEmpty == true)
    }

    @Test func metadataEncodesTextAndNumberScalars() throws {
        let row = EventRow(EventInput(
            verb: .created,
            object: EventObject(.task, "t1"),
            metadata: ["ticket_num": .number(12), "kind": .text("decision")]
        ))
        let data = try JSONEncoder().encode(row)
        let json = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        let metadata = try #require(json["metadata"] as? [String: Any])
        #expect(metadata["ticket_num"] as? Int == 12)
        #expect(metadata["kind"] as? String == "decision")
    }

    // MARK: task verbs (src/app/tasks/actions.ts)

    @Test func movingATaskToDoneIsCompleted() {
        let old = taskSnapshot(status: "inprogress")
        let verb = EventRules.taskUpdateVerb(old: old, new: task(status: .done))
        #expect(verb == .completed)
    }

    @Test func otherBoardMovesAreSilent() {
        // "Board moves are constant churn — the timeline only cares about done."
        let old = taskSnapshot(status: "todo")
        #expect(EventRules.taskUpdateVerb(old: old, new: task(status: .inprogress)) == nil)
        // Already done, moved back: still nothing.
        #expect(EventRules.taskUpdateVerb(old: taskSnapshot(status: "done"), new: task(status: .review)) == nil)
    }

    @Test func takingAnUnclaimedTicketIsClaimed() {
        // The Swift sheet sets assignee at the same time as claimed_by; claiming
        // still wins over a generic `updated`.
        let new = task(assignee: "u1", claimedBy: "u1")
        #expect(EventRules.taskUpdateVerb(old: taskSnapshot(), new: new) == .claimed)
    }

    @Test func releasingATicketIsSilent() {
        let old = taskSnapshot(assignee: "u1", claimedBy: "u1")
        #expect(EventRules.taskUpdateVerb(old: old, new: task(assignee: "u1", claimedBy: nil)) == nil)
    }

    @Test func editingTaskFieldsIsUpdated() {
        #expect(EventRules.taskUpdateVerb(old: taskSnapshot(), new: task(title: "Renamed")) == .updated)
        #expect(EventRules.taskUpdateVerb(old: taskSnapshot(), new: task(priority: .high)) == .updated)
        #expect(
            EventRules.taskUpdateVerb(
                old: taskSnapshot(),
                new: task(checklist: [ChecklistItem(text: "Ship it", done: false)])
            ) == .updated
        )
    }

    @Test func aFailedPreReadStillEmitsUpdated() {
        // The before-state read is best effort; losing it must not lose the event.
        #expect(EventRules.taskUpdateVerb(old: nil, new: task()) == .updated)
        #expect(EventRules.promptUpdateVerb(old: nil, new: prompt()) == .updated)
        #expect(EventRules.ideaUpdateVerb(old: nil, new: idea()) == .updated)
    }

    // MARK: prompt verbs (src/app/prompts/actions.ts)

    @Test func starringAPromptIsFavorited() {
        #expect(EventRules.promptUpdateVerb(old: promptSnapshot(), new: prompt(isFavorite: true)) == .favorited)
    }

    @Test func unstarringAPromptIsSilent() {
        // "Only favoriting is a signal; un-favoriting is feed noise."
        let old = promptSnapshot(isFavorite: true)
        #expect(EventRules.promptUpdateVerb(old: old, new: prompt(isFavorite: false)) == nil)
    }

    @Test func editingAPromptIsUpdatedEvenWhenFavoriteChanges() {
        let old = promptSnapshot()
        #expect(EventRules.promptUpdateVerb(old: old, new: prompt(title: "Renamed")) == .updated)
        #expect(EventRules.promptUpdateVerb(old: old, new: prompt(title: "Renamed", isFavorite: true)) == .updated)
        // Re-submitting the form unchanged behaves like the web app: `updated`.
        #expect(EventRules.promptUpdateVerb(old: old, new: prompt()) == .updated)
    }

    // MARK: idea verbs (src/app/ideas/actions.ts)

    @Test func editingIdeaContentIsUpdated() {
        #expect(EventRules.ideaUpdateVerb(old: ideaSnapshot(), new: idea(title: "LandlordOS 2")) == .updated)
        #expect(EventRules.ideaUpdateVerb(old: ideaSnapshot(), new: idea(problem: "Spreadsheets")) == .updated)
    }

    /// Regression: these used to be silent, mirroring the web's inline
    /// `patchIdea`. The Swift IdeaSheet has no inline path — verdict, status and
    /// the score sliders are part of the same Save as the prose fields — so
    /// scoring an idea has to reach the timeline.
    @Test func verdictStatusAndScoreChangesAreUpdated() {
        let old = ideaSnapshot()
        #expect(EventRules.ideaUpdateVerb(old: old, new: idea(verdict: .strong)) == .updated)
        #expect(EventRules.ideaUpdateVerb(old: old, new: idea(status: .archived)) == .updated)
        #expect(EventRules.ideaUpdateVerb(old: old, new: idea(scores: ["problem": 8])) == .updated)
        // Verdict *and* status together, the reviewer's exact case.
        #expect(
            EventRules.ideaUpdateVerb(
                old: old,
                new: idea(verdict: .strong, status: .validating)
            ) == .updated
        )
    }

    @Test func savingAnIdeaUnchangedIsSilent() {
        #expect(EventRules.ideaUpdateVerb(old: ideaSnapshot(), new: idea()) == nil)
    }

    // MARK: project verbs (src/app/projects/actions.ts)

    @Test func completingAProjectIsCompleted() {
        #expect(EventRules.projectUpdateVerb(status: .completed) == .completed)
        #expect(EventRules.projectUpdateVerb(status: .active) == .updated)
        #expect(EventRules.projectUpdateVerb(status: .paused) == .updated)
        #expect(EventRules.projectUpdateVerb(status: .archived) == .updated)
    }

    /// `events.project_id` is an FK into `projects`. A project-deleted event
    /// fires after the row is gone, so any project scope on it is a guaranteed
    /// insert failure — the one payload mistake that loses the event outright.
    @Test func projectDeletedEventCarriesNoProjectScope() throws {
        let input = EventRules.projectDeleted(id: "p1", name: "Market research")
        #expect(input.projectId == nil)

        let row = EventRow(input)
        #expect(row.verb == "deleted")
        #expect(row.object_type == "project")
        #expect(row.object_id == "p1")
        #expect(row.object_label == "Market research")
        #expect(row.project_id == nil)

        // And the column must be absent from the wire payload, not sent as null.
        let data = try JSONEncoder().encode(row)
        let json = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(json["project_id"] == nil)
    }

    /// The label is denormalized precisely so history survives the delete, but
    /// it's nullable — losing it must not block the event.
    @Test func projectDeletedToleratesAMissingLabel() {
        #expect(EventRow(EventRules.projectDeleted(id: "p1", name: nil)).object_label == nil)
    }

    // MARK: fixtures — identical before/after unless a parameter is overridden

    private func taskSnapshot(
        title: String = "Ship the macOS app",
        priority: String = "med",
        status: String = "todo",
        assignee: String? = nil,
        claimedBy: String? = nil,
        checklist: [ChecklistItem] = []
    ) -> EventRules.TaskSnapshot {
        EventRules.TaskSnapshot(
            title: title, description: nil, priority: priority, area: "frontend",
            status: status, assignee: assignee, claimed_by: claimedBy, checklist: checklist
        )
    }

    private func task(
        title: String = "Ship the macOS app",
        priority: TaskPriority = .med,
        status: TaskStatus = .todo,
        assignee: String? = nil,
        claimedBy: String? = nil,
        checklist: [ChecklistItem] = []
    ) -> TaskItem {
        TaskItem(
            id: "t1", projectId: "p1", ticketNum: 1, title: title, description: nil,
            priority: priority, area: .frontend, status: status, assignee: assignee,
            claimedBy: claimedBy, checklist: checklist, createdBy: "u1",
            createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z"
        )
    }

    private func promptSnapshot(
        title: String = "V2 restyle",
        rating: Int? = 5,
        isFavorite: Bool = false
    ) -> EventRules.PromptSnapshot {
        EventRules.PromptSnapshot(
            title: title, prompt_text: "Restyle this…", response_notes: nil,
            ai_tool: "claude-code", rating: rating, project_id: "p1", is_favorite: isFavorite
        )
    }

    private func prompt(
        title: String = "V2 restyle",
        rating: Int? = 5,
        isFavorite: Bool = false
    ) -> Prompt {
        Prompt(
            id: "pr1", userId: "u1", projectId: "p1", title: title, promptText: "Restyle this…",
            responseNotes: nil, aiTool: "claude-code", rating: rating, isFavorite: isFavorite,
            createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z"
        )
    }

    private func ideaSnapshot(
        title: String = "LandlordOS",
        problem: String? = nil,
        verdict: String? = nil,
        status: String = "draft",
        scores: [String: Int] = [:]
    ) -> EventRules.IdeaSnapshot {
        EventRules.IdeaSnapshot(
            title: title, tagline: "Rent for small landlords", problem: problem, customer: nil,
            solution: nil, revenue_model: nil, stack_notes: nil, source_url: nil,
            verdict: verdict, status: status, scores: scores
        )
    }

    private func idea(
        title: String = "LandlordOS",
        problem: String? = nil,
        verdict: IdeaVerdict? = nil,
        status: IdeaStatus = .draft,
        scores: [String: Int] = [:]
    ) -> Idea {
        Idea(
            id: "i1", title: title, tagline: "Rent for small landlords", problem: problem,
            customer: nil, solution: nil, revenueModel: nil, stackNotes: nil, verdict: verdict,
            status: status, scores: scores, sourceUrl: nil, promotedProjectId: nil,
            createdBy: "u1", createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z"
        )
    }
}
