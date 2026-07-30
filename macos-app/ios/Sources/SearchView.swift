import SandboxBrainKit
import SwiftUI

// Search — one box across every entity, same scope as the web app.
// Port of the Mac SearchView with a native iOS search field.

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
                    TextField("Projects, notes, prompts, ideas, tasks…", text: $query)
                        .textFieldStyle(.plain)
                        .font(.system(size: 14))
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
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
        .toolbarBackground(.hidden, for: .navigationBar)
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
