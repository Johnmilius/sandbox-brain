import Foundation
import Network
import Testing

@testable import SandboxBrainKit

// The vetting an inbound request has to survive before it can consume the
// one-shot sign-in continuation. Pure functions, so none of this opens a
// socket — the binding itself (127.0.0.1 only) needs a live check, see
// macos-app/README.md.

@Suite struct LoopbackTests {

    // MARK: peer address

    @Test func acceptsLoopbackPeers() {
        #expect(LoopbackCallbackServer.isLoopback(.hostPort(host: .ipv4(.loopback), port: 52847)))
        #expect(LoopbackCallbackServer.isLoopback(.hostPort(host: .ipv6(.loopback), port: 52847)))
        #expect(LoopbackCallbackServer.isLoopback(.hostPort(host: .name("localhost", nil), port: 52847)))
    }

    @Test func rejectsOffMachinePeers() {
        #expect(!LoopbackCallbackServer.isLoopback(.hostPort(host: .ipv4(IPv4Address("192.168.1.42")!), port: 52847)))
        #expect(!LoopbackCallbackServer.isLoopback(.hostPort(host: .ipv4(IPv4Address("10.0.0.7")!), port: 52847)))
        #expect(!LoopbackCallbackServer.isLoopback(.hostPort(host: .name("evil.example", nil), port: 52847)))
        #expect(!LoopbackCallbackServer.isLoopback(nil))
    }

    // MARK: request line

    @Test func readsTheTargetFromAGetLine() {
        let raw = "GET /auth/callback?code=abc123 HTTP/1.1\r\nHost: localhost:52847\r\n\r\n"
        #expect(LoopbackCallbackServer.requestTarget(raw) == "/auth/callback?code=abc123")
    }

    @Test func rejectsNonGetAndMalformedRequestLines() {
        #expect(LoopbackCallbackServer.requestTarget("POST /auth/callback?code=a HTTP/1.1\r\n\r\n") == nil)
        #expect(LoopbackCallbackServer.requestTarget("GET\r\n\r\n") == nil)
        #expect(LoopbackCallbackServer.requestTarget("") == nil)
        // A TLS ClientHello or other binary noise decodes to junk, not a verb.
        #expect(LoopbackCallbackServer.requestTarget("\u{16}\u{03}\u{01}garbage") == nil)
    }

    // MARK: callback shape

    @Test func acceptsTheRealCallback() {
        #expect(LoopbackCallbackServer.isCallbackTarget("/auth/callback?code=abc123"))
        // Google/Supabase can bounce back a refusal instead of a code; that has
        // to resume too, or a declined sign-in hangs until the 5-minute timeout.
        #expect(LoopbackCallbackServer.isCallbackTarget("/auth/callback?error=access_denied&error_description=nope"))
    }

    @Test func rejectsAProbeThatWouldStrandASignIn() {
        // The case that matters: something reaches the port mid-sign-in with a
        // bare GET. Consuming the continuation here would drop the real
        // callback that arrives moments later.
        #expect(!LoopbackCallbackServer.isCallbackTarget("/auth/callback"))
        #expect(!LoopbackCallbackServer.isCallbackTarget("/auth/callback?"))
        #expect(!LoopbackCallbackServer.isCallbackTarget("/auth/callback?next=/"))
    }

    @Test func rejectsOtherPaths() {
        #expect(!LoopbackCallbackServer.isCallbackTarget("/?code=abc"))
        #expect(!LoopbackCallbackServer.isCallbackTarget("/favicon.ico"))
        // Prefix matching used to let these through.
        #expect(!LoopbackCallbackServer.isCallbackTarget("/auth/callbackfoo?code=abc"))
        #expect(!LoopbackCallbackServer.isCallbackTarget("/auth/callback/../../x?code=abc"))
    }
}
