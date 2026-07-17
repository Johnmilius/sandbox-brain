import SandboxBrainKit
import SwiftUI

// MARK: - Graph (live force-directed simulation, Obsidian-style)

@MainActor
@Observable
final class GraphSim {
    struct Node: Identifiable {
        let id: String       // "type:uuid"
        let label: String
        let type: String
        var position: CGPoint = .zero
        var velocity: CGVector = CGVector(dx: 0, dy: 0)
        var degree: Int = 0
        var baseRadius: CGFloat { min(5 + 2.2 * sqrt(CGFloat(degree)), 14) }
    }

    var nodes: [Node] = []
    var edges: [(Int, Int)] = []          // indices into nodes
    var alpha: Double = 0                  // simulation "heat"
    var draggedIndex: Int?
    var size: CGSize = CGSize(width: 800, height: 520)

    // Tunable forces (the Obsidian-style sliders bind to these).
    var repulsion: Double = 1400           // push between all nodes
    var linkStrength: Double = 0.06        // pull along edges
    var linkDistance: Double = 95          // resting edge length
    var centerStrength: Double = 0.012     // gravity toward center
    var nodeScale: Double = 1.0            // visual node size multiplier

    func radius(of node: Node) -> CGFloat { node.baseRadius * nodeScale }

    /// Rebuild the graph, keeping positions of nodes that already exist.
    func load(nodes newNodes: [(id: String, label: String, type: String)], edges edgePairs: [(String, String)]) {
        let old = Dictionary(uniqueKeysWithValues: nodes.map { ($0.id, $0) })
        var built: [Node] = []
        var indexOf: [String: Int] = [:]
        for n in newNodes {
            var node = Node(id: n.id, label: n.label, type: n.type)
            if let prior = old[n.id] {
                node.position = prior.position
                node.velocity = prior.velocity
            } else {
                // Seed new nodes on a jittered circle so the sim unfolds nicely.
                let angle = Double.random(in: 0..<(2 * .pi))
                let r = Double.random(in: 0.15...0.35)
                node.position = CGPoint(
                    x: size.width / 2 + cos(angle) * size.width * r,
                    y: size.height / 2 + sin(angle) * size.height * r
                )
            }
            indexOf[n.id] = built.count
            built.append(node)
        }
        var builtEdges: [(Int, Int)] = []
        for (a, b) in edgePairs {
            if let i = indexOf[a], let j = indexOf[b], i != j {
                builtEdges.append((i, j))
                built[i].degree += 1
                built[j].degree += 1
            }
        }
        nodes = built
        edges = builtEdges
        alpha = 1.0
    }

    func reheat(_ to: Double = 0.5) { alpha = max(alpha, to) }

    /// One physics tick. Forces mirror d3-force defaults (what Obsidian uses):
    /// many-body repulsion, link springs, gentle centering, velocity decay.
    func step() {
        guard !nodes.isEmpty, alpha > 0.005 else { return }
        let count = nodes.count
        var force = [CGVector](repeating: CGVector(dx: 0, dy: 0), count: count)

        // Many-body repulsion
        for i in 0..<count {
            for j in (i + 1)..<count {
                let dx = nodes[i].position.x - nodes[j].position.x
                let dy = nodes[i].position.y - nodes[j].position.y
                var distSq = dx * dx + dy * dy
                if distSq < 1 { distSq = 1 }
                let dist = distSq.squareRoot()
                let strength = repulsion / distSq * alpha
                let fx = strength * dx / dist
                let fy = strength * dy / dist
                force[i].dx += fx; force[i].dy += fy
                force[j].dx -= fx; force[j].dy -= fy
            }
        }

        // Link springs
        for (i, j) in edges {
            let dx = nodes[j].position.x - nodes[i].position.x
            let dy = nodes[j].position.y - nodes[i].position.y
            let dist = max(sqrt(dx * dx + dy * dy), 1)
            let stretch = (dist - linkDistance) * linkStrength * alpha
            let fx = stretch * dx / dist
            let fy = stretch * dy / dist
            force[i].dx += fx; force[i].dy += fy
            force[j].dx -= fx; force[j].dy -= fy
        }

        // Centering + integrate
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        for i in 0..<count {
            if i == draggedIndex { nodes[i].velocity = CGVector(dx: 0, dy: 0); continue }
            var v = nodes[i].velocity
            v.dx += force[i].dx + (center.x - nodes[i].position.x) * centerStrength * alpha
            v.dy += force[i].dy + (center.y - nodes[i].position.y) * centerStrength * alpha
            v.dx *= 0.82; v.dy *= 0.82                      // velocity decay
            let speed = sqrt(v.dx * v.dx + v.dy * v.dy)
            if speed > 14 { v.dx *= 14 / speed; v.dy *= 14 / speed }
            nodes[i].velocity = v
            var p = nodes[i].position
            p.x = min(max(p.x + v.dx, 24), size.width - 24)
            p.y = min(max(p.y + v.dy, 24), size.height - 24)
            nodes[i].position = p
        }

        alpha *= 0.985                                       // cool down
    }

    func nearestNode(to point: CGPoint, within: CGFloat = 26) -> Int? {
        var best: (Int, CGFloat)?
        for (i, node) in nodes.enumerated() {
            let dx = node.position.x - point.x
            let dy = node.position.y - point.y
            let d = sqrt(dx * dx + dy * dy)
            if d < within && d < (best?.1 ?? .infinity) { best = (i, d) }
        }
        return best?.0
    }
}

struct GraphView: View {
    @Environment(AppState.self) private var state
    @State private var sim = GraphSim()
    @State private var hoveredId: String?
    @State private var showControls = false

    // View transform: screen = world * zoom + pan
    @State private var zoom: CGFloat = 1
    @State private var pan: CGSize = .zero
    @State private var panAtDragStart: CGSize?
    @State private var zoomAtPinchStart: CGFloat?
    @State private var canvasSize: CGSize = .zero

    @State private var clock = Timer.publish(every: 1.0 / 60.0, on: .main, in: .common).autoconnect()

    var body: some View {
        Page(kicker: "Graph", title: "How it all connects", trailing: AnyView(
            Button { withAnimation(.snappy) { showControls.toggle() } } label: {
                Label("Forces", systemImage: "slider.horizontal.3")
            }
            .buttonStyle(.glass)
        )) {
            GlassCard(padding: 0) {
                GeometryReader { geo in
                    ZStack(alignment: .topTrailing) {
                        canvas
                        if showControls { controlPanel.padding(10) }
                        zoomControls
                    }
                    .onAppear {
                        sim.size = geo.size
                        canvasSize = geo.size
                        rebuild()
                    }
                    .onChange(of: geo.size) {
                        sim.size = geo.size
                        canvasSize = geo.size
                        sim.reheat(0.3)
                    }
                }
                .frame(height: 540)
                .clipShape(.rect(cornerRadius: 16))
            }
            legend
        }
        .onReceive(clock) { _ in sim.step() }
        .onChange(of: state.links.count) { rebuild() }
        .onChange(of: state.notes.count) { rebuild() }
    }

    // MARK: transform helpers

    private func toWorld(_ p: CGPoint) -> CGPoint {
        CGPoint(x: (p.x - pan.width) / zoom, y: (p.y - pan.height) / zoom)
    }

    /// Change zoom, keeping the given screen point fixed in place.
    private func setZoom(_ newZoom: CGFloat, around screenPoint: CGPoint) {
        let clamped = min(max(newZoom, 0.35), 3.5)
        let world = toWorld(screenPoint)
        pan = CGSize(
            width: screenPoint.x - world.x * clamped,
            height: screenPoint.y - world.y * clamped
        )
        zoom = clamped
    }

    private var canvasCenter: CGPoint {
        CGPoint(x: canvasSize.width / 2, y: canvasSize.height / 2)
    }

    // MARK: canvas

    private var canvas: some View {
        Canvas { context, _ in
            context.translateBy(x: pan.width, y: pan.height)
            context.scaleBy(x: zoom, y: zoom)
            // Edges
            for (i, j) in sim.edges {
                let a = sim.nodes[i].position
                let b = sim.nodes[j].position
                var path = SwiftUI.Path()
                path.move(to: a)
                path.addLine(to: b)
                let active = hoveredId != nil && (sim.nodes[i].id == hoveredId || sim.nodes[j].id == hoveredId)
                context.stroke(path, with: .color(Brand.mutedText.opacity(active ? 0.7 : 0.28)), lineWidth: (active ? 1.5 : 1) / zoom)
            }
            // Nodes + labels
            for node in sim.nodes {
                let r = sim.radius(of: node)
                let rect = CGRect(x: node.position.x - r, y: node.position.y - r, width: r * 2, height: r * 2)
                let isHovered = node.id == hoveredId
                if isHovered {
                    context.fill(.init(ellipseIn: rect.insetBy(dx: -4, dy: -4)), with: .color(color(for: node.type).opacity(0.25)))
                }
                context.fill(.init(ellipseIn: rect), with: .color(color(for: node.type)))
                // Labels fade out while zooming away and back in up close
                // (Obsidian-style); hubs with more links hold theirs longer.
                let zoomFade = (zoom - 0.55) / 0.4
                let hubBonus = CGFloat(node.degree) * 0.06
                let labelOpacity = isHovered ? 1 : min(max(zoomFade + hubBonus, 0), 1) * 0.75
                if labelOpacity > 0.02 {
                    let label = Text(node.label)
                        .font(.system(size: isHovered ? 11 : 9, weight: isHovered ? .semibold : .medium))
                        .foregroundStyle(Brand.ink.opacity(labelOpacity))
                    context.draw(context.resolve(label), at: CGPoint(x: node.position.x, y: node.position.y + r + 9), anchor: .top)
                }
            }
        }
        .background(Brand.cream.opacity(0.4))
        .gesture(dragGesture)
        .simultaneousGesture(pinchGesture)
        .onContinuousHover { phase in
            switch phase {
            case .active(let point):
                hoveredId = sim.nearestNode(to: toWorld(point), within: 26 / zoom).map { sim.nodes[$0].id }
            case .ended:
                hoveredId = nil
            }
        }
    }

    // MARK: gestures — drag a node, or drag empty space to pan

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if sim.draggedIndex == nil && panAtDragStart == nil {
                    if let hit = sim.nearestNode(to: toWorld(value.startLocation), within: 26 / zoom) {
                        sim.draggedIndex = hit
                    } else {
                        panAtDragStart = pan
                    }
                }
                if let i = sim.draggedIndex {
                    sim.nodes[i].position = toWorld(value.location)
                    sim.reheat(0.55)
                } else if let start = panAtDragStart {
                    pan = CGSize(width: start.width + value.translation.width,
                                 height: start.height + value.translation.height)
                }
            }
            .onEnded { value in
                if let i = sim.draggedIndex {
                    // Fling: hand the drag velocity to the sim (in world units).
                    sim.nodes[i].velocity = CGVector(
                        dx: (value.predictedEndLocation.x - value.location.x) / zoom,
                        dy: (value.predictedEndLocation.y - value.location.y) / zoom
                    ) * 0.15
                    sim.reheat(0.4)
                }
                sim.draggedIndex = nil
                panAtDragStart = nil
            }
    }

    private var pinchGesture: some Gesture {
        MagnifyGesture()
            .onChanged { value in
                if zoomAtPinchStart == nil { zoomAtPinchStart = zoom }
                setZoom((zoomAtPinchStart ?? 1) * value.magnification, around: canvasCenter)
            }
            .onEnded { _ in zoomAtPinchStart = nil }
    }

    // MARK: overlays

    private var zoomControls: some View {
        VStack(spacing: 6) {
            Button { setZoom(zoom * 1.25, around: canvasCenter) } label: { Image(systemName: "plus") }
            Button { setZoom(zoom / 1.25, around: canvasCenter) } label: { Image(systemName: "minus") }
            Button {
                withAnimation(.snappy) { zoom = 1; pan = .zero }
            } label: { Image(systemName: "scope") }
                .help("Reset view")
        }
        .buttonStyle(.glass)
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
    }

    private var controlPanel: some View {
        FlatCard(padding: 14) {
            VStack(alignment: .leading, spacing: 10) {
                MonoLabel(text: "Forces")
                forceSlider("Push", value: Binding(
                    get: { sim.repulsion },
                    set: { sim.repulsion = $0; sim.reheat(0.35) }
                ), range: 100...6000)
                forceSlider("Pull", value: Binding(
                    get: { sim.linkStrength },
                    set: { sim.linkStrength = $0; sim.reheat(0.35) }
                ), range: 0.005...0.2)
                forceSlider("Link distance", value: Binding(
                    get: { sim.linkDistance },
                    set: { sim.linkDistance = $0; sim.reheat(0.35) }
                ), range: 30...260)
                forceSlider("Gravity", value: Binding(
                    get: { sim.centerStrength },
                    set: { sim.centerStrength = $0; sim.reheat(0.35) }
                ), range: 0...0.06)
                forceSlider("Node size", value: Binding(
                    get: { sim.nodeScale },
                    set: { sim.nodeScale = $0 }
                ), range: 0.4...2.5)
                Button("Reset forces") {
                    sim.repulsion = 1400
                    sim.linkStrength = 0.06
                    sim.linkDistance = 95
                    sim.centerStrength = 0.012
                    sim.nodeScale = 1
                    sim.reheat(0.5)
                }
                .font(.system(size: 11))
            }
        }
        .frame(width: 230)
    }

    private func forceSlider(_ label: String, value: Binding<Double>, range: ClosedRange<Double>) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            MonoLabel(text: label)
            Slider(value: value, in: range)
                .controlSize(.mini)
        }
    }

    private func rebuild() {
        var nodeList: [(id: String, label: String, type: String)] = []
        var seen = Set<String>()
        func add(_ type: String, _ id: String, _ label: String) {
            let key = "\(type):\(id)"
            guard seen.insert(key).inserted else { return }
            nodeList.append((key, label, type))
        }
        for link in state.links {
            for (type, id) in [(link.sourceType, link.sourceId), (link.targetType, link.targetId)] {
                switch type {
                case "project": if let p = state.project(id) { add(type, id, p.name) }
                case "note": if let n = state.notes.first(where: { $0.id == id }) { add(type, id, n.title) }
                case "prompt": if let p = state.prompts.first(where: { $0.id == id }) { add(type, id, p.title) }
                case "knowledge_item": if let k = state.knowledge.first(where: { $0.id == id }) { add(type, id, k.title) }
                case "profile": if let p = state.profile(id) { add(type, id, p.displayName) }
                case "idea": if let i = state.ideas.first(where: { $0.id == id }) { add(type, id, i.title) }
                case "task": if let t = state.tasks.first(where: { $0.id == id }) { add(type, id, t.title) }
                case "agent": if let a = state.agents.first(where: { $0.id == id }) { add(type, id, a.name) }
                default: break
                }
            }
        }
        for note in state.notes { add("note", note.id, note.title) }

        var edgeList: [(String, String)] = state.links.map {
            ("\($0.sourceType):\($0.sourceId)", "\($0.targetType):\($0.targetId)")
        }
        for note in state.notes {
            for target in wikiLinkTitles(note.body) {
                if let match = state.notes.first(where: { $0.title.lowercased() == target.lowercased() }) {
                    edgeList.append(("note:\(note.id)", "note:\(match.id)"))
                }
            }
        }
        sim.load(nodes: nodeList, edges: edgeList)
    }

    private func wikiLinkTitles(_ body: String) -> [String] {
        var titles: [String] = []
        var rest = Substring(body)
        while let open = rest.range(of: "[["), let close = rest.range(of: "]]", range: open.upperBound..<rest.endIndex) {
            titles.append(String(rest[open.upperBound..<close.lowerBound]))
            rest = rest[close.upperBound...]
        }
        return titles
    }

    private func color(for type: String) -> Color {
        switch type {
        case "project": Brand.green
        case "note": Brand.purple
        case "prompt": .orange
        case "knowledge_item": Brand.ink
        case "profile": Color(red: 0.13, green: 0.52, blue: 0.62)
        case "idea": .yellow
        case "task": .red
        case "agent": .pink
        default: Brand.mutedText
        }
    }

    private var legend: some View {
        HStack(spacing: 10) {
            ForEach(["project", "note", "prompt", "knowledge_item", "profile", "idea", "task", "agent"], id: \.self) { type in
                HStack(spacing: 4) {
                    Circle().fill(color(for: type)).frame(width: 7, height: 7)
                    MonoLabel(text: type.replacingOccurrences(of: "_", with: " "))
                }
            }
            Spacer()
            MonoLabel(text: "drag nodes to rearrange")
        }
    }
}

private extension CGVector {
    static func * (lhs: CGVector, rhs: CGFloat) -> CGVector {
        CGVector(dx: lhs.dx * rhs, dy: lhs.dy * rhs)
    }
}

// MARK: - Search (across everything, grouped by kind)

struct SearchView: View {
    @Environment(AppState.self) private var state
    @State private var query = ""
    @State private var hits: [SearchHit] = []
    @State private var searching = false
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        Page(kicker: "Search", title: "Find anything") {
            GlassCard(padding: 12) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").foregroundStyle(Brand.mutedText)
                    TextField("Search projects, notes, prompts, knowledge, ideas, tasks, agents…", text: $query)
                        .textFieldStyle(.plain)
                        .font(.system(size: 14))
                        .onSubmit(runSearch)
                    if searching { ProgressView().controlSize(.small) }
                }
            }
            .onChange(of: query) {
                searchTask?.cancel()
                searchTask = Task {
                    try? await Task.sleep(for: .milliseconds(350))
                    guard !Task.isCancelled else { return }
                    runSearch()
                }
            }

            if query.isEmpty {
                EmptyStateView(symbol: "magnifyingglass", title: "Search the brain", message: "One box across every entity — same scope as the web app's search.")
            } else if hits.isEmpty && !searching {
                EmptyStateView(symbol: "questionmark.circle", title: "No matches", message: "Nothing matched \"\(query)\".")
            } else {
                ForEach(SearchHitKind.allCases, id: \.self) { kind in
                    let group = hits.filter { $0.kind == kind }
                    if !group.isEmpty {
                        MonoLabel(text: "\(kind.rawValue)s")
                        ForEach(group) { hit in
                            FlatCard(padding: 12) {
                                HStack {
                                    Text(hit.title)
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundStyle(Brand.ink)
                                    Spacer()
                                    StatusPill(label: hit.subtitle, color: Brand.mutedText)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private func runSearch() {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty, let backend = state.backend else {
            hits = []
            return
        }
        searching = true
        Task {
            defer { searching = false }
            hits = (try? await backend.search(q)) ?? []
        }
    }
}
