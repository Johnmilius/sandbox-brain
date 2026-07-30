import Foundation

// Codable rows mirroring supabase/migrations. IDs and timestamps stay Strings
// (same shape the web app works with); parse on display via Support.swift.

public struct Profile: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var email: String
    public var fullName: String?
    public var avatarUrl: String?

    public var displayName: String {
        if let fullName, !fullName.isEmpty { return fullName }
        return email.split(separator: "@").first.map(String.init) ?? email
    }

    public var initials: String {
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

public enum ProjectStatus: String, Codable, CaseIterable, Sendable {
    case active, paused, completed, archived
}

public struct Project: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var description: String?
    public var status: ProjectStatus
    public var startedOn: String?
    public var endedOn: String?
    public var ticketPrefix: String?
    public var createdBy: String
    public var createdAt: String
    public var updatedAt: String

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

public enum TimeEntrySource: String, Codable, Sendable { case timer, manual }

public struct TimeEntry: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var userId: String
    public var projectId: String
    public var startedAt: String
    public var endedAt: String?
    public var notes: String?
    public var source: TimeEntrySource

    public var isRunning: Bool { endedAt == nil }
    public func durationMs(now: Date = Date()) -> Double {
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

public struct Prompt: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var userId: String
    public var projectId: String?
    public var title: String
    public var promptText: String
    public var responseNotes: String?
    public var aiTool: String?
    public var rating: Int?
    public var isFavorite: Bool
    public var createdAt: String
    public var updatedAt: String

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

public struct Note: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var authorId: String
    public var title: String
    public var body: String
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, body
        case authorId = "author_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

public enum KnowledgeKind: String, Codable, CaseIterable, Sendable {
    case codeSnippet = "code_snippet"
    case decision
    case document
    case contact
    case projectArchive = "project_archive"

    public var label: String {
        switch self {
        case .codeSnippet: "Code snippet"
        case .decision: "Decision"
        case .document: "Document"
        case .contact: "Contact"
        case .projectArchive: "Project archive"
        }
    }

    public var symbol: String {
        switch self {
        case .codeSnippet: "curlybraces"
        case .decision: "checkmark.seal"
        case .document: "doc.text"
        case .contact: "person.crop.circle"
        case .projectArchive: "archivebox"
        }
    }
}

public struct KnowledgeItem: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var kind: KnowledgeKind
    public var title: String
    public var description: String?
    public var content: String?
    public var url: String?
    public var projectId: String?
    public var createdBy: String
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, kind, title, description, content, url
        case projectId = "project_id"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

public enum AgentStatus: String, Codable, CaseIterable, Sendable { case active, archived }

public struct Agent: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var description: String?
    public var systemPrompt: String?
    public var model: String?
    public var tools: [String]
    public var status: AgentStatus
    public var projectId: String?
    public var createdBy: String
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, description, model, tools, status
        case systemPrompt = "system_prompt"
        case projectId = "project_id"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

public enum TaskPriority: String, Codable, CaseIterable, Sendable {
    case high, med, low
    public var label: String { rawValue == "med" ? "Medium" : rawValue.capitalized }
}

public enum TaskArea: String, Codable, CaseIterable, Sendable { case frontend, backend, design, copy }

public enum TaskStatus: String, Codable, CaseIterable, Sendable {
    case backlog, todo, inprogress, review, done
    public var label: String {
        switch self {
        case .backlog: "Backlog"
        case .todo: "To do"
        case .inprogress: "In progress"
        case .review: "Review"
        case .done: "Done"
        }
    }
}

public struct ChecklistItem: Codable, Hashable, Sendable {
    public var text: String
    public var done: Bool

    public init(text: String, done: Bool) {
        self.text = text
        self.done = done
    }
}

public struct TaskItem: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var projectId: String
    public var ticketNum: Int
    public var title: String
    public var description: String?
    public var priority: TaskPriority
    public var area: TaskArea
    public var status: TaskStatus
    public var assignee: String?
    public var claimedBy: String?
    public var checklist: [ChecklistItem]
    public var createdBy: String
    public var createdAt: String
    public var updatedAt: String

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

public enum IdeaVerdict: String, Codable, CaseIterable, Sendable { case strong, conditional, pass }

public enum IdeaStatus: String, Codable, CaseIterable, Sendable {
    case draft, validating, promoted, archived
}

public struct Idea: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var title: String
    public var tagline: String?
    public var problem: String?
    public var customer: String?
    public var solution: String?
    public var revenueModel: String?
    public var stackNotes: String?
    public var verdict: IdeaVerdict?
    public var status: IdeaStatus
    public var scores: [String: Int]
    public var sourceUrl: String?
    public var promotedProjectId: String?
    public var createdBy: String
    public var createdAt: String
    public var updatedAt: String

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

public struct AcademyModule: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var slug: String
    public var title: String
    public var description: String?
    public var kind: String
    public var sortOrder: Int

    enum CodingKeys: String, CodingKey {
        case id, slug, title, description, kind
        case sortOrder = "sort_order"
    }
}

public struct AcademyStep: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var moduleId: String
    public var stepNo: Int
    public var title: String
    public var promptText: String
    public var stepType: String

    enum CodingKeys: String, CodingKey {
        case id, title
        case moduleId = "module_id"
        case stepNo = "step_no"
        case promptText = "prompt_text"
        case stepType = "step_type"
    }
}

public struct StepProgress: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var userId: String
    public var stepId: String
    public var completedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case stepId = "step_id"
        case completedAt = "completed_at"
    }
}

public struct AcademyOutcome: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var slug: String
    public var name: String
    public var description: String?
    public var sortOrder: Int

    enum CodingKeys: String, CodingKey {
        case id, slug, name, description
        case sortOrder = "sort_order"
    }
}

public struct OutcomeAssessment: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var userId: String
    public var outcomeId: String
    public var rating: Int
    public var confidence: Int?
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case id, rating, confidence, note
        case userId = "user_id"
        case outcomeId = "outcome_id"
    }
}

public struct EntityLink: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var sourceType: String
    public var sourceId: String
    public var targetType: String
    public var targetId: String
    public var relationship: String

    enum CodingKeys: String, CodingKey {
        case id, relationship
        case sourceType = "source_type"
        case sourceId = "source_id"
        case targetType = "target_type"
        case targetId = "target_id"
    }
}

// MARK: - Search

public enum SearchHitKind: String, CaseIterable, Sendable {
    case project, note, prompt, knowledge, idea, task, agent
}

public struct SearchHit: Identifiable, Hashable, Sendable {
    public let id: String
    public let kind: SearchHitKind
    public let title: String
    public let subtitle: String
}
