import Foundation
import Testing

@testable import SandboxBrain

// Exercises the BrainBackend contract against the in-memory DemoBackend — no
// Supabase, no network. Confirms the seed data loads and that a representative
// create + timer mutation flows through the backing actor.

@Suite struct DemoBackendTests {

    @Test func seedDataIsPopulated() async throws {
        let b = DemoBackend()
        #expect(try await b.projects().count > 0)
        #expect(try await b.tasks().count > 0)
        #expect(try await b.notes().count > 0)
        #expect(try await b.profiles().count > 0)
    }

    @Test func createNoteAddsToTheList() async throws {
        let b = DemoBackend()
        let before = try await b.notes().count
        try await b.createNote(title: "Test note", body: "hello [[world]]")
        let after = try await b.notes()
        #expect(after.count == before + 1)
        #expect(after.contains { $0.title == "Test note" })
    }

    @Test func startAndStopTimerTogglesRunningState() async throws {
        let b = DemoBackend()
        let project = try await b.projects()[0]

        try await b.startTimer(projectId: project.id, notes: "focus block")
        let running = try await b.timeEntries(since: nil).first {
            $0.isRunning && $0.userId == DemoStore.lukeId
        }
        let entry = try #require(running)

        try await b.stopTimer(entryId: entry.id)
        let afterStop = try await b.timeEntries(since: nil).first { $0.id == entry.id }
        #expect(afterStop?.isRunning == false)
    }
}
