import Foundation

// Codable rows mirroring supabase/migrations. IDs and timestamps stay Strings
// (same shape the web app works with); parse on display via Support.swift.

struct Profile: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var email: String
    var fullName: String?
    var avatarUrl: String?

    var displayName: String {
        if let fullName, !fullName.isEmpty { return fullName }
        return email.split(separator: "@").first.map(String.init) ?? email
    }

    var initials: String {
        let parts = displayName.split(separator: " ")
        let letters = parts.prefix(2).compactMap { $0.first }
        return String(letters).uppercased()
    }

    enum CodingKeys: String, CodingKey {
        case id, email
        case fullName = "full_name"
        case avatarUrl = "avatar_url"
    }
}

enum ProjectStatus: String, Codable, CaseIterable, Sendable {
    case active, paused, completed, archived
}

struct Project: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var name: String
    var description: String?
    var status: ProjectStatus
    var startedOn: String?
    var endedOn: String?
    var ticketPrefix: String?
    var createdBy: String
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, description, status
        case startedOn = "started_on"
        case endedOn = "ended_on"
        case ticketPrefix = "ticket_prefix"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

enum TimeEntrySource: String, Codable, Sendable { case timer, manual }

struct TimeEntry: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var userId: String
    var projectId: String
    var startedAt: String
    var endedAt: String?
    var notes: String?
    var source: TimeEntrySource

    var isRunning: Bool { endedAt == nil }
    func durationMs(now: Date = Date()) -> Double {
        entryDurationMs(startedAt: startedAt, endedAt: endedAt, now: now)
    }

    enum CodingKeys: String, CodingKey {
        case id, notes, source
        case userId = "user_id"
        case projectId = "project_id"
        case startedAt = "started_at"
        case endedAt = "ended_at"
    }
}

struct Prompt: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var userId: String
    var projectId: String?
    var title: String
    var promptText: String
    var responseNotes: String?
    var aiTool: String?
    var rating: Int?
    var isFavorite: Bool
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, rating
        case userId = "user_id"
        case projectId = "project_id"
        case promptText = "prompt_text"
        case responseNotes = "response_notes"
        case aiTool = "ai_tool"
        case isFavorite = "is_favorite"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct Note: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var authorId: String
    var title: String
    var body: String
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, body
        case authorId = "author_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

enum KnowledgeKind: String, Codable, CaseIterable, Sendable {
    case codeSnippet = "code_snippet"
    case decision
    case document
    case contact
    case projectArchive = "project_archive"

    var label: String {
        switch self {
        case .codeSnippet: "Code snippet"
        case .decision: "Decision"
        case .document: "Document"
        case .contact: "Contact"
        case .projectArchive: "Project archive"
        }
    }

    var symbol: String {
        switch self {
        case .codeSnippet: "curlybraces"
        case .decision: "checkmark.seal"
        case .document: "doc.text"
        case .contact: "person.crop.circle"
        case .projectArchive: "archivebox"
        }
    }
}

struct KnowledgeItem: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var kind: KnowledgeKind
    var title: String
    var description: String?
    var content: String?
    var url: String?
    var projectId: String?
    var createdBy: String
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, kind, title, description, content, url
        case projectId = "project_id"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

enum AgentStatus: String, Codable, CaseIterable, Sendable { case active, archived }

struct Agent: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var name: String
    var description: String?
    var systemPrompt: String?
    var model: String?
    var tools: [String]
    var status: AgentStatus
    var projectId: String?
    var createdBy: String
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, description, model, tools, status
        case systemPrompt = "system_prompt"
        case projectId = "project_id"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

enum TaskPriority: String, Codable, CaseIterable, Sendable {
    case high, med, low
    var label: String { rawValue == "med" ? "Medium" : rawValue.capitalized }
}

enum TaskArea: String, Codable, CaseIterable, Sendable { case frontend, backend, design, copy }

enum TaskStatus: String, Codable, CaseIterable, Sendable {
    case backlog, todo, inprogress, review, done
    var label: String {
        switch self {
        case .backlog: "Backlog"
        case .todo: "To do"
        case .inprogress: "In progress"
        case .review: "Review"
        case .done: "Done"
        }
    }
}

struct ChecklistItem: Codable, Hashable, Sendable {
    var text: String
    var done: Bool
}

struct TaskItem: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var projectId: String
    var ticketNum: Int
    var title: String
    var description: String?
    var priority: TaskPriority
    var area: TaskArea
    var status: TaskStatus
    var assignee: String?
    var claimedBy: String?
    var checklist: [ChecklistItem]
    var createdBy: String
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, description, priority, area, status, assignee, checklist
        case projectId = "project_id"
        case ticketNum = "ticket_num"
        case claimedBy = "claimed_by"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

enum IdeaVerdict: String, Codable, CaseIterable, Sendable { case strong, conditional, pass }

enum IdeaStatus: String, Codable, CaseIterable, Sendable {
    case draft, validating, promoted, archived
}

struct Idea: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var title: String
    var tagline: String?
    var problem: String?
    var customer: String?
    var solution: String?
    var revenueModel: String?
    var stackNotes: String?
    var verdict: IdeaVerdict?
    var status: IdeaStatus
    var scores: [String: Int]
    var sourceUrl: String?
    var promotedProjectId: String?
    var createdBy: String
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, tagline, problem, customer, solution, verdict, status, scores
        case revenueModel = "revenue_model"
        case stackNotes = "stack_notes"
        case sourceUrl = "source_url"
        case promotedProjectId = "promoted_project_id"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct AcademyModule: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var slug: String
    var title: String
    var description: String?
    var kind: String
    var sortOrder: Int

    enum CodingKeys: String, CodingKey {
        case id, slug, title, description, kind
        case sortOrder = "sort_order"
    }
}

struct AcademyStep: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var moduleId: String
    var stepNo: Int
    var title: String
    var promptText: String
    var stepType: String

    enum CodingKeys: String, CodingKey {
        case id, title
        case moduleId = "module_id"
        case stepNo = "step_no"
        case promptText = "prompt_text"
        case stepType = "step_type"
    }
}

struct StepProgress: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var userId: String
    var stepId: String
    var completedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case stepId = "step_id"
        case completedAt = "completed_at"
    }
}

struct AcademyOutcome: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var slug: String
    var name: String
    var description: String?
    var sortOrder: Int

    enum CodingKeys: String, CodingKey {
        case id, slug, name, description
        case sortOrder = "sort_order"
    }
}

struct OutcomeAssessment: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var userId: String
    var outcomeId: String
    var rating: Int
    var confidence: Int?
    var note: String?

    enum CodingKeys: String, CodingKey {
        case id, rating, confidence, note
        case userId = "user_id"
        case outcomeId = "outcome_id"
    }
}

struct EntityLink: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var sourceType: String
    var sourceId: String
    var targetType: String
    var targetId: String
    var relationship: String

    enum CodingKeys: String, CodingKey {
        case id, relationship
        case sourceType = "source_type"
        case sourceId = "source_id"
        case targetType = "target_type"
        case targetId = "target_id"
    }
}

// MARK: - Search

enum SearchHitKind: String, CaseIterable, Sendable {
    case project, note, prompt, knowledge, idea, task, agent
}

struct SearchHit: Identifiable, Hashable, Sendable {
    let id: String
    let kind: SearchHitKind
    let title: String
    let subtitle: String
}
