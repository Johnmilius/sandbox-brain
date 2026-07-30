import Foundation

// The app's navigation sections. Lives in the kit (not the mac executable)
// because AppState.forcedSection is typed on it and the iOS app will reuse it.

public enum Section: String, CaseIterable, Identifiable, Sendable {
    case home = "Home"
    case projects = "Projects"
    case ideas = "Ideas"
    case tasks = "Tasks"
    case time = "Time"
    case prompts = "Prompts"
    case agents = "Agents"
    case notes = "Notes"
    case brain = "Brain"
    case graph = "Graph"
    case academy = "Academy"
    case growth = "Growth"
    case search = "Search"

    public var id: String { rawValue }

    public var symbol: String {
        switch self {
        case .home: "house"
        case .projects: "square.grid.2x2"
        case .ideas: "lightbulb"
        case .tasks: "square.split.2x1"
        case .time: "clock"
        case .prompts: "quote.opening"
        case .agents: "sparkles"
        case .notes: "pencil"
        case .brain: "brain"
        case .graph: "point.3.connected.trianglepath.dotted"
        case .academy: "graduationcap"
        case .growth: "chart.line.uptrend.xyaxis"
        case .search: "magnifyingglass"
        }
    }
}
