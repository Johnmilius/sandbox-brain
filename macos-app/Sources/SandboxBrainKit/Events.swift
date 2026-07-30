import Foundation
import Supabase

// MARK: - The events timeline
//
// Swift port of packages/core/src/events.ts, writing the table defined in
// supabase/migrations/0009_events.sql. Every write path — web server actions,
// MCP tools, and now the Mac/iOS apps — appends one row to `events`; the home
// activity feed and the per-object History panels are derived from that log, so
// anything the Swift apps do without emitting is invisible to the team.
//
// Three rules carried over from the TypeScript implementation:
//
//   1. Never throws. A failed event write must not break (or appear to break)
//      the user action that triggered it. `LiveBackend.emit` is non-throwing and
//      swallows everything after logging to stderr.
//   2. `actor_id` is never sent. The RLS insert policy is
//      `is_team_member() and actor_id = auth.uid()`, and the column already
//      defaults to `auth.uid()` — the apps sign in as the real user, so letting
//      the default apply is both correct and the only thing RLS accepts.
//   3. Labels are denormalized at emit time so the feed renders without joins
//      and history survives deletion of the object.

/// Verb vocabulary. Free text in the database (growing it must never need DDL);
/// this enum mirrors `EVENT_VERBS` in packages/core/src/events.ts.
enum EventVerb: String, Sendable, CaseIterable {
    case created
    case updated
    case deleted
    case completed
    case started
    case stopped
    case loggedTime = "logged_time"
    case linked
    case rated
    case favorited
    case promoted
    case claimed
    case ingested
}

/// The `object_types` registry (supabase/migrations/0008_object_registry.sql).
/// `events.object_type` / `target_type` are FKs into it, so unknown strings are
/// rejected by the database — hence an enum rather than raw text.
enum EventObjectType: String, Sendable, CaseIterable {
    case project
    case note
    case prompt
    case knowledgeItem = "knowledge_item"
    case profile
    case timeEntry = "time_entry"
    case agent
    case academyModule = "academy_module"
    case academyOutcome = "academy_outcome"
    case idea
    case task
}

/// One end of an event: what was acted on, or what it was acted on against.
struct EventObject: Sendable, Equatable {
    let type: EventObjectType
    let id: String
    let label: String?

    init(_ type: EventObjectType, _ id: String, label: String? = nil) {
        self.type = type
        self.id = id
        self.label = label
    }
}

/// The handful of JSON scalars the app actually puts in `metadata`
/// (ticket numbers, knowledge kinds, timer bounds, ratings, step ids).
enum EventMetaValue: Encodable, Sendable, Equatable {
    case text(String)
    case number(Int)

    func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .text(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        }
    }
}

/// Mirrors `EventInput` in packages/core/src/events.ts, minus `source`
/// (always `app` here) and `actorId` (always the DB default — see rule 2).
struct EventInput: Sendable, Equatable {
    var verb: EventVerb
    var object: EventObject
    var target: EventObject?
    /// Scopes the web app's "my projects" feed filter.
    var projectId: String?
    var metadata: [String: EventMetaValue]

    init(
        verb: EventVerb,
        object: EventObject,
        target: EventObject? = nil,
        projectId: String? = nil,
        metadata: [String: EventMetaValue] = [:]
    ) {
        self.verb = verb
        self.object = object
        self.target = target
        self.projectId = projectId
        self.metadata = metadata
    }
}

/// The exact row POSTed to `public.events`. Snake-cased to match the columns;
/// nil optionals are omitted by the synthesized encoder, which lets the column
/// defaults (null / now() / auth.uid()) apply.
struct EventRow: Encodable, Sendable, Equatable {
    let verb: String
    let object_type: String
    let object_id: String
    let object_label: String?
    let target_type: String?
    let target_id: String?
    let target_label: String?
    let project_id: String?
    let source: String
    let metadata: [String: EventMetaValue]

    init(_ input: EventInput) {
        verb = input.verb.rawValue
        object_type = input.object.type.rawValue
        object_id = input.object.id
        object_label = input.object.label
        target_type = input.target?.type.rawValue
        target_id = input.target?.id
        target_label = input.target?.label
        project_id = input.projectId
        source = "app" // events.source check: app | mcp | connector
        metadata = input.metadata
    }
}

/// Stderr, never stdout: the loopback server and CLI snapshot mode both treat
/// stdout as data. `fputs` to the unbuffered `stderr` can't throw, so logging a
/// failure can't itself become one.
func logEventFailure(_ input: EventInput, _ reason: String) {
    fputs(
        "emitEvent failed (\(input.verb.rawValue) \(input.object.type.rawValue):\(input.object.id)): \(reason)\n",
        stderr
    )
}

// MARK: - Verb selection
//
// The web app splits its writes across narrow server actions (updateTaskStatus
// vs claimTask vs updateTask; togglePromptFavorite vs updatePrompt; patchIdea vs
// updateIdea) and picks a different verb — or stays silent — in each. The Swift
// backend has one `update*(_ model:)` per entity, so it reads the row's
// before-state and reconstructs the same decision here. Pure functions, so the
// mapping is unit-testable without a database.

enum EventRules {

    // MARK: tasks

    /// The columns `updateTask` can change, as they exist before the write.
    struct TaskSnapshot: Decodable, Sendable, Equatable {
        var title: String
        var description: String?
        var priority: String
        var area: String
        var status: String
        var assignee: String?
        var claimed_by: String?
        var checklist: [ChecklistItem]

        static let columns = "title, description, priority, area, status, assignee, claimed_by, checklist"
    }

    /// Mirrors src/app/tasks/actions.ts:
    ///   * moving to `done` → `completed` (updateTaskStatus)
    ///   * taking an unclaimed ticket → `claimed` (claimTask; the Swift sheet
    ///     sets `assignee` at the same time, so claiming wins over `updated`)
    ///   * editing fields → `updated` (updateTask)
    ///   * anything else — a board move that isn't "done", a release — is
    ///     deliberately silent: "board moves are constant churn".
    /// A missing snapshot (the pre-read failed) falls back to `updated` so the
    /// action still shows up in the feed.
    static func taskUpdateVerb(old: TaskSnapshot?, new: TaskItem) -> EventVerb? {
        guard let old else { return .updated }
        if new.status == .done, old.status != TaskStatus.done.rawValue { return .completed }
        if old.claimed_by == nil, new.claimedBy != nil { return .claimed }
        let contentChanged = old.title != new.title
            || old.description != new.description
            || old.priority != new.priority.rawValue
            || old.area != new.area.rawValue
            || old.assignee != new.assignee
            || old.checklist != new.checklist
        return contentChanged ? .updated : nil
    }

    // MARK: prompts

    struct PromptSnapshot: Decodable, Sendable, Equatable {
        var title: String
        var prompt_text: String
        var response_notes: String?
        var ai_tool: String?
        var rating: Int?
        var project_id: String?
        var is_favorite: Bool

        static let columns = "title, prompt_text, response_notes, ai_tool, rating, project_id, is_favorite"
    }

    /// Mirrors src/app/prompts/actions.ts: starring a prompt on its own is
    /// `favorited` (togglePromptFavorite), un-starring is "feed noise" and stays
    /// silent, and any real edit is `updated`.
    static func promptUpdateVerb(old: PromptSnapshot?, new: Prompt) -> EventVerb? {
        guard let old else { return .updated }
        let contentChanged = old.title != new.title
            || old.prompt_text != new.promptText
            || old.response_notes != new.responseNotes
            || old.ai_tool != new.aiTool
            || old.rating != new.rating
            || old.project_id != new.projectId
        if !contentChanged, new.isFavorite != old.is_favorite {
            return new.isFavorite ? .favorited : nil
        }
        return .updated
    }

    // MARK: ideas

    /// Every field `updateIdea` writes. The web app also has a narrower
    /// `patchIdea` for its inline verdict/status/score controls, which emits
    /// nothing — but the Swift `IdeaSheet` has no such inline path: the status
    /// Picker, verdict Picker and score Sliders live inside the same form as the
    /// prose fields, behind one Save. So lifecycle movement is part of a form
    /// submit here and is tracked like one, matching what the equivalent web
    /// form action emits.
    struct IdeaSnapshot: Decodable, Sendable, Equatable {
        var title: String
        var tagline: String?
        var problem: String?
        var customer: String?
        var solution: String?
        var revenue_model: String?
        var stack_notes: String?
        var source_url: String?
        var verdict: String?
        var status: String
        var scores: [String: Int]

        static let columns = """
            title, tagline, problem, customer, solution, revenue_model, stack_notes, \
            source_url, verdict, status, scores
            """
    }

    /// `updated` for any real change the sheet can make; silent only when Save
    /// changed nothing at all.
    static func ideaUpdateVerb(old: IdeaSnapshot?, new: Idea) -> EventVerb? {
        guard let old else { return .updated }
        let changed = old.title != new.title
            || old.tagline != new.tagline
            || old.problem != new.problem
            || old.customer != new.customer
            || old.solution != new.solution
            || old.revenue_model != new.revenueModel
            || old.stack_notes != new.stackNotes
            || old.source_url != new.sourceUrl
            || old.verdict != new.verdict?.rawValue
            || old.status != new.status.rawValue
            || old.scores != new.scores
        return changed ? .updated : nil
    }

    // MARK: projects

    /// src/app/projects/actions.ts decides purely from the submitted status.
    static func projectUpdateVerb(status: ProjectStatus) -> EventVerb {
        status == .completed ? .completed : .updated
    }

    /// The one event whose shape is load-bearing: `events.project_id` is an FK
    /// into `projects`, and by the time this is written the project row is gone,
    /// so scoping the event to it would fail the insert outright. Built here
    /// rather than inline in `deleteProject` so a test can hold the invariant.
    static func projectDeleted(id: String, name: String?) -> EventInput {
        EventInput(verb: .deleted, object: EventObject(.project, id, label: name), projectId: nil)
    }
}

// MARK: - Emission + the small reads events need

extension LiveBackend {

    /// Append one event. Non-throwing by signature *and* by body: every failure
    /// — encoding, transport, RLS, a hung request — is logged and swallowed so
    /// the caller's mutation is never rolled back or reported as failed.
    func emit(_ input: EventInput) async {
        do {
            try await db.from("events").insert(EventRow(input)).execute()
        } catch {
            logEventFailure(input, "\(error)")
        }
    }

    /// Convenience for the common `verb + object` shape.
    func emit(
        _ verb: EventVerb,
        _ object: EventObject,
        target: EventObject? = nil,
        projectId: String? = nil,
        metadata: [String: EventMetaValue] = [:]
    ) async {
        await emit(EventInput(verb: verb, object: object, target: target, projectId: projectId, metadata: metadata))
    }

    /// Best-effort single-row read used only to enrich events (labels and
    /// before-states). Returns nil on any failure — events degrade, mutations
    /// don't. `limit(1)` + array decoding rather than `.single()`, which throws
    /// when nothing matches.
    func eventLookup<T: Decodable & Sendable>(
        _ type: T.Type = T.self,
        table: String,
        id: String,
        columns: String
    ) async -> T? {
        let rows: [T]? = try? await db.from(table)
            .select(columns)
            .eq("id", value: id)
            .limit(1)
            .execute()
            .value
        return rows?.first
    }

    /// A single denormalized text label, e.g. a project's name or a note's title.
    func eventLabel(table: String, id: String, column: String) async -> String? {
        struct LabelRow: Decodable, Sendable { var label: String? }
        // PostgREST column alias keeps one decodable shape for every table.
        let row: LabelRow? = await eventLookup(table: table, id: id, columns: "label:\(column)")
        return row?.label
    }

    /// `time_entry` events carry the project as their target, labelled the way
    /// src/app/time/actions.ts labels it.
    func projectTarget(_ projectId: String) async -> EventObject {
        EventObject(.project, projectId, label: await eventLabel(table: "projects", id: projectId, column: "name"))
    }
}

// MARK: - Rows returned by mutating writes
//
// The create* methods used to insert blind, which left events without an
// `object_id`. Adding `.select(...)` (PostgREST `return=representation`) hands
// the new row back in the same round trip. Decoded as an array rather than via
// `.single()` so a surprising empty response costs the event, not the mutation.

struct InsertedId: Decodable, Sendable {
    let id: String
}

struct InsertedProject: Decodable, Sendable {
    let id: String
    let name: String
}

/// What `stopTimer` needs for its `logged_time` event.
struct StoppedTimer: Decodable, Sendable {
    let id: String
    let project_id: String
    let started_at: String
    let ended_at: String?
}
