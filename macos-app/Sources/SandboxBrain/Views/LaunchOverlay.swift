import SandboxBrainKit
import SwiftUI

// Branded boot screen — covers the window while the first data load runs.
// Entrance: the ink squircle springs in, the brain draws itself on (macOS 26
// symbol draw animation), title + dots settle in, then a calm breathe loop.

struct LaunchOverlay: View {
    @State private var squircleIn = false
    @State private var glyphIn = false
    @State private var textIn = false
    @State private var breathe = false
    @State private var dotPhase = 0

    @State private var dotTimer = Timer.publish(every: 0.35, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            Brand.cream.ignoresSafeArea()

            VStack(spacing: 20) {
                ZStack {
                    // Deliberately OPPOSITE of the system theme (unlike the
                    // Dock icon) so the mark stands out against the page.
                    RoundedRectangle(cornerRadius: 21)
                        .fill(Brand.ink)
                        .frame(width: 84, height: 84)
                        .shadow(color: .black.opacity(breathe ? 0.26 : 0.12),
                                radius: breathe ? 22 : 12, y: 8)
                    if glyphIn {
                        Image(systemName: "brain.fill")
                            .font(.system(size: 38))
                            .foregroundStyle(Brand.cream)
                            .transition(.symbolEffect(.drawOn.individually))
                    }
                }
                .scaleEffect(squircleIn ? (breathe ? 1.05 : 1.0) : 0.4)
                .opacity(squircleIn ? 1 : 0)

                VStack(spacing: 6) {
                    Text("Sandbox Brain")
                        .font(.system(size: 26, weight: .medium, design: .serif))
                        .foregroundStyle(Brand.ink)
                    HStack(spacing: 7) {
                        ForEach(0..<3, id: \.self) { i in
                            Circle()
                                .fill(Brand.ink)
                                .frame(width: 6, height: 6)
                                .opacity(dotPhase == i ? 0.9 : 0.25)
                                .scaleEffect(dotPhase == i ? 1.2 : 1.0)
                        }
                    }
                    .animation(.easeInOut(duration: 0.3), value: dotPhase)
                }
                .opacity(textIn ? 1 : 0)
                .offset(y: textIn ? 0 : 10)
            }
        }
        .onAppear {
            withAnimation(.spring(duration: 0.5, bounce: 0.35)) {
                squircleIn = true
            }
            withAnimation(.easeOut(duration: 0.4).delay(0.25)) {
                glyphIn = true
            }
            withAnimation(.easeOut(duration: 0.5).delay(0.55)) {
                textIn = true
            }
            // Hand off to the calm breathe loop once the entrance lands.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.1) {
                withAnimation(.easeInOut(duration: 1.4).repeatForever(autoreverses: true)) {
                    breathe = true
                }
            }
        }
        .onReceive(dotTimer) { _ in
            dotPhase = (dotPhase + 1) % 3
        }
    }
}
