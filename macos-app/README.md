# Sandbox Brain for macOS

Native SwiftUI port of the Sandbox Brain web app — same Supabase backend, same
data, wrapped in a Liquid Glass macOS 26 interface. Everything the site does
lives here: Home digest, Projects, Ideas, Tasks board, Time tracking, Prompts,
Agents, Notes with `[[wiki-links]]`, Brain knowledge base, the entity Graph,
Academy progress, and Growth charts.

## Requirements

- macOS 26 (Tahoe) or later
- To build: Swift 6 toolchain (Xcode 26 or Command Line Tools)

## Build & install

```sh
cd macos-app
./build-app.sh            # → build/Sandbox Brain.app
./build-app.sh install    # also copies to /Applications and launches
```

No Xcode project needed — it's a Swift Package (same pattern as a plain
`swift build`), and `build-app.sh` wraps the binary into a signed `.app`.

The build is ad-hoc signed. If a teammate sends you a pre-built zip instead,
right-click → Open the first time to get past Gatekeeper.

## Team onboarding (first launch)

1. **Connect** — paste the **invite code** a teammate sent you (or, under
   Advanced, the Supabase Project URL + anon key from Settings → API). These
   are the same public values every website visitor receives; they're kept in
   `~/Library/Application Support/Sandbox Brain/config.json`.
2. **Sign in with Google** — the same account that's on the team allowlist.
3. That's it. If you see "Not on the team allowlist", ask a teammate to add
   your Gmail to the `allowed_emails` table.

Not on the team? **Demo mode** on the welcome screen explores the whole app
with sample data, no credentials needed.

### How sign-in works

Primary path: an **in-window** sheet (`ASWebAuthenticationSession`) that
redirects to the app's custom scheme `sandboxbrain://auth-callback`. No ports,
no browser hop.

If that's unavailable, it falls back to a **loopback**: the app opens Google in
your default browser and briefly listens on
`http://localhost:52847/auth/callback` to catch the redirect. The port is in the
private range (49152–65535) so it won't clash with a running dev server.

Both redirect URLs (`sandboxbrain://auth-callback` and
`http://localhost:52847/auth/callback`) must be on the Supabase project's
redirect allowlist (Auth → URL Configuration).

## Security notes

- The Supabase URL + anon key are **public** client values (the website ships
  them to every browser), stored in Application Support — deliberately not
  Keychain, because ad-hoc-signed rebuilds change the app's identity and
  orphan keychain items.
- Auth sessions (the sensitive part) are persisted by supabase-swift's own
  Keychain storage; after replacing an ad-hoc build you may need to sign in
  again for the same reason.
- The anon key is the *public* client key; data access is enforced substantially
  by Row Level Security (`is_team_member()`) — identical to the web app.
- The service-role key is never used or asked for. Nothing secret is committed.
- The loopback listener binds `127.0.0.1` only, refuses connections from any
  non-loopback peer, and ignores requests that don't carry an OAuth `code` or
  `error` — so a stray probe of the port can't consume the sign-in that's in
  flight. To confirm the bind after a change, start a sign-in and run
  `lsof -iTCP:52847 -sTCP:LISTEN` in another terminal: the NAME column must read
  `127.0.0.1:52847`, never `*:52847`.

## Dev tools

- `swift tools/make-icon.swift` — regenerates `Resources/AppIcon.icns`.
- `SB_SNAPSHOT_DIR=/tmp/shots .build/debug/SandboxBrain` — boots demo mode,
  walks every section, and exits (smoke test used during development).
