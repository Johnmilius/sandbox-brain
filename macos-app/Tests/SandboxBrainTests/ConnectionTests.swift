import Foundation
import Testing

@testable import SandboxBrainKit

// The pure invite-code + connection-validation helpers extracted from AppState.
// No disk or network: makeInviteCode/decodeInviteCode are inverses, and
// validateConnection returns the exact user-facing error strings.

@Suite struct ConnectionTests {

    // MARK: invite code round-trip

    @Test func inviteCodeRoundTrips() {
        let url = "https://xyzcompany.supabase.co"
        let key = "sb_publishable_abc123"
        let code = AppState.makeInviteCode(urlString: url, anonKey: key)
        #expect(code.hasPrefix(AppState.inviteCodePrefix))

        let decoded = AppState.decodeInviteCode(code)
        #expect(decoded?.urlString == url)
        #expect(decoded?.anonKey == key)
    }

    @Test func decodeToleratesSurroundingWhitespace() {
        let code = AppState.makeInviteCode(urlString: "https://a.supabase.co", anonKey: "k")
        #expect(AppState.decodeInviteCode("  \n\(code)\t ") != nil)
    }

    @Test func decodeRejectsMalformedCodes() {
        #expect(AppState.decodeInviteCode("") == nil)
        #expect(AppState.decodeInviteCode("hello world") == nil)          // no prefix
        #expect(AppState.decodeInviteCode(AppState.inviteCodePrefix + "!!not-base64!!") == nil)
        // Valid prefix + base64 but missing the "|" separator.
        let noPipe = AppState.inviteCodePrefix + Data("just-a-url".utf8).base64EncodedString()
        #expect(AppState.decodeInviteCode(noPipe) == nil)
    }

    // MARK: connection validation

    @Test func validateAcceptsHttpsProjectURL() {
        let result = AppState.validateConnection(urlString: "  https://xyzcompany.supabase.co  ", anonKey: "  key123  ")
        switch result {
        case .valid(_, let urlString, let anonKey):
            #expect(urlString == "https://xyzcompany.supabase.co") // trimmed, byte-preserved
            #expect(anonKey == "key123")
        case .invalid(let message):
            Issue.record("expected valid, got: \(message)")
        }
    }

    @Test func validateRejectsNonHTTPS() {
        let result = AppState.validateConnection(urlString: "http://xyz.supabase.co", anonKey: "key")
        #expect(isInvalid(result, containing: "should look like https"))
    }

    @Test func validateRejectsDashboardHost() {
        let result = AppState.validateConnection(urlString: "https://supabase.com/dashboard/project/abc", anonKey: "key")
        #expect(isInvalid(result, containing: "dashboard address"))
    }

    @Test func validateRejectsEmptyKey() {
        let result = AppState.validateConnection(urlString: "https://xyz.supabase.co", anonKey: "   ")
        #expect(isInvalid(result, containing: "anon (public) key"))
    }

    // Helper: assert an .invalid outcome whose message contains `needle`.
    private func isInvalid(_ result: AppState.ConnectionValidation, containing needle: String) -> Bool {
        if case .invalid(let message) = result { return message.contains(needle) }
        return false
    }
}
