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
            listener = try NWListener(using: .tcp, on: NWEndpoint.Port(rawValue: port)!)
        } catch {
            throw NSError(domain: "SandboxBrain", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Couldn't open the local sign-in port (\(port)). Something else is using it — quit that app and try signing in again."
            ])
        }

        return try await withCheckedThrowingContinuation { continuation in
            let flag = Flag()

            listener.newConnectionHandler = { connection in
                connection.start(queue: .main)
                connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, _, _, _ in
                    let request = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
                    let path = request.split(separator: "\r\n").first?
                        .split(separator: " ").dropFirst().first.map(String.init) ?? ""

                    guard path.hasPrefix("/auth/callback") else {
                        respond(connection, status: "404 Not Found", body: "Not found")
                        return
                    }
                    respond(connection, status: "200 OK", body: successPage)
                    if flag.tryResume(), let url = URL(string: "http://localhost:\(port)\(path)") {
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
