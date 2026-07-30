#if os(macOS)
import AppKit
#elseif os(iOS)
import UIKit
#endif
import Foundation
import Network

// Loopback OAuth callback: a *fallback* for when the primary in-window
// sign-in (the `sandboxbrain://` custom scheme) is unavailable. The app
// listens on a dedicated high port during sign-in and catches the redirect
// locally. The matching `http://localhost:52847/auth/callback` must be on the
// Supabase project's redirect allowlist (Auth → URL Configuration).
//
// The port lives in the private range (49152–65535) specifically so it won't
// collide with a running dev server (e.g. Next.js on :3000).
//
// "Locally" is enforced, not assumed. `NWListener(using:on:)` would bind every
// interface, which puts the sign-in window on the LAN: the first caller to
// reach /auth/callback wins the continuation, so anything that could reach the
// port could drop a real sign-in on the floor. Three narrowings, cheapest
// first: bind the loopback address only, drop connections whose peer isn't
// loopback, and require the request to actually look like an OAuth result
// rather than resuming on any GET.

enum AuthLoopback {
    static let port: UInt16 = 52847
    static var redirectURL: URL { URL(string: "http://localhost:\(port)/auth/callback")! }
}

enum LoopbackCallbackServer {
    /// Not-Sendable-by-design guard; every touch happens on the main queue.
    private final class Flag: @unchecked Sendable {
        var resumed = false
        func tryResume() -> Bool {
            if resumed { return false }
            resumed = true
            return true
        }
    }

    /// Start listening, open `authURL` in the default browser, and return the
    /// full callback URL when Google → Supabase redirects back to localhost.
    @MainActor
    static func run(port: UInt16, openURL authURL: URL) async throws -> URL {
        let listener: NWListener
        do {
            let parameters = NWParameters.tcp
            // Bind 127.0.0.1 rather than every interface. The browser resolves
            // `localhost` to ::1 first on a dual-stack Mac, gets refused, and
            // falls back to 127.0.0.1 immediately — the usual native-app OAuth
            // arrangement (RFC 8252 §7.3).
            parameters.requiredLocalEndpoint = .hostPort(
                host: .ipv4(.loopback),
                port: NWEndpoint.Port(rawValue: port)!
            )
            // A previous attempt's socket may still be in TIME_WAIT; without
            // this, retrying sign-in inside two minutes fails to bind.
            parameters.allowLocalEndpointReuse = true
            listener = try NWListener(using: parameters)
        } catch {
            throw NSError(domain: "SandboxBrain", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Couldn't open the local sign-in port (\(port)). Something else is using it — quit that app and try signing in again."
            ])
        }

        return try await withCheckedThrowingContinuation { continuation in
            let flag = Flag()

            listener.newConnectionHandler = { connection in
                // Belt-and-braces behind requiredLocalEndpoint: if the bind is
                // ever loosened, this still refuses anything off-machine.
                guard isLoopback(connection.endpoint) else {
                    connection.cancel()
                    return
                }
                connection.start(queue: .main)
                connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, _, _, _ in
                    let request = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""

                    guard let target = requestTarget(request), isCallbackTarget(target) else {
                        respond(connection, status: "404 Not Found", body: "Not found")
                        return
                    }
                    respond(connection, status: "200 OK", body: successPage)
                    if flag.tryResume(), let url = URL(string: "http://localhost:\(port)\(target)") {
                        listener.cancel()
                        continuation.resume(returning: url)
                    }
                }
            }

            listener.stateUpdateHandler = { state in
                if case .failed(let error) = state, flag.tryResume() {
                    continuation.resume(throwing: error)
                }
            }

            listener.start(queue: .main)
            #if os(macOS)
            NSWorkspace.shared.open(authURL)
            #else
            UIApplication.shared.open(authURL)
            #endif

            // Give up after 5 minutes so an abandoned attempt doesn't hold
            // the port (and the button) forever.
            DispatchQueue.main.asyncAfter(deadline: .now() + 300) {
                if flag.tryResume() {
                    listener.cancel()
                    continuation.resume(throwing: URLError(.timedOut))
                }
            }
        }
    }

    // MARK: - Request vetting
    //
    // Pure and internal (not private) so LoopbackTests can exercise them
    // without opening a socket — same arrangement as EventRules.

    /// True when `endpoint` is this machine talking to itself.
    static func isLoopback(_ endpoint: NWEndpoint?) -> Bool {
        guard case .hostPort(let host, _) = endpoint else { return false }
        switch host {
        case .ipv4(let address): return address.isLoopback
        case .ipv6(let address): return address.isLoopback
        case .name(let name, _): return name == "localhost"
        @unknown default: return false
        }
    }

    /// The request target from an HTTP request line ("GET /a?b=c HTTP/1.1").
    /// nil for anything that isn't a well-formed GET — the callback only ever
    /// arrives as a browser navigation.
    static func requestTarget(_ raw: String) -> String? {
        guard let line = raw.split(separator: "\r\n").first else { return nil }
        let parts = line.split(separator: " ")
        guard parts.count >= 2, parts[0] == "GET" else { return nil }
        return String(parts[1])
    }

    /// True only for the callback path carrying an OAuth result. Requiring
    /// `code`/`error` means a bare probe of the port can't consume the
    /// one-shot continuation and strand a sign-in that is still in flight.
    static func isCallbackTarget(_ target: String) -> Bool {
        guard let parsed = URLComponents(string: target), parsed.path == "/auth/callback" else {
            return false
        }
        let names = Set((parsed.queryItems ?? []).map(\.name))
        return names.contains("code") || names.contains("error")
    }

    private static func respond(_ connection: NWConnection, status: String, body: String) {
        let response = """
        HTTP/1.1 \(status)\r
        Content-Type: text/html; charset=utf-8\r
        Content-Length: \(body.utf8.count)\r
        Connection: close\r
        \r
        \(body)
        """
        connection.send(content: Data(response.utf8), completion: .contentProcessed { _ in
            connection.cancel()
        })
    }

    private static let successPage = """
    <!doctype html><meta charset="utf-8"><title>Signed in</title>
    <body style="margin:0;display:grid;place-items:center;height:100vh;background:#faf9f7;font-family:ui-serif,Georgia,serif;color:#1c1c1f">
    <div style="text-align:center">
      <div style="width:72px;height:72px;margin:0 auto 14px;background:#1c1c1f;border-radius:18px;display:grid;place-items:center">
        <span style="font-size:34px">🧠</span>
      </div>
      <h1 style="font-weight:500;font-size:26px;margin:0 0 6px">You're signed in</h1>
      <p style="font-family:ui-sans-serif,system-ui;font-size:14px;color:#78716c;margin:0">Close this tab and head back to Sandbox Brain.</p>
    </div>
    """
}
