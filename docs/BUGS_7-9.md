1. ## Error Type
Recoverable Error

## Error Message
Hydration failed because the server rendered text didn't match the client. As a result this tree will be regenerated on the client. This can happen if a SSR-ed Client Component used:

- A server/client branch `if (typeof window !== 'undefined')`.
- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

https://react.dev/link/hydration-mismatch

  ...
    <RedirectBoundary>
      <RedirectErrorBoundary router={{...}}>
        <Head>
        <__next_root_layout_boundary__>
          <SegmentViewNode type="layout" pagePath="layout.tsx">
            <SegmentTrieNode>
            <link>
            <script>
            <script>
            <script>
            <script>
            <script>
            <script>
            <RootLayout>
              <html lang="en" className="geist_f00f..." suppressHydrationWarning={true}>
                <body className="geist_f00f...">
                  <AppShell>
                    <div className="flex h-dvh...">
                      ...
                        <div className="mt-2 flex ...">
                          <TimerChip runningEntry={{id:"856bea...", ...}}>
                            <div className="jsx-60db59...">
                              <div style={{...}} className="jsx-60db59...">
                                <div className="jsx-60db59...">
                                  <span>
                                  <span
                                    className="jsx-60db59d05ec0a7d2 font-mono text-[14px] font-medium text-[var(--v2-i..."
                                  >
+                                   38:07
-                                   38:06
                                  ...
                                ...
                              ...
                          ...
                      ...
                  ...
        ...



    at <unknown> (+                                   38:7:null)
    at <unknown> (-                                   38:6:null)
    at span (<anonymous>:null:null)
    at TimerChip (src/components/shell/timer-chip.tsx:166:11)
    at Sidebar (src/components/shell/sidebar.tsx:120:9)
    at AppShell (src\components\shell\app-shell.tsx:101:7)
    at RootLayout (src\app\layout.tsx:50:17)

## Code Frame
  164 |             />
  165 |           </span>
> 166 |           <span className="font-mono ...
      |           ^
  167 |             {isRunning ? formatClock(...
  168 |           </span>
  169 |           <div className="ml-auto fle...

Next.js version: 16.2.10 (Turbopack)


