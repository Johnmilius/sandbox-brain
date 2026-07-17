import SandboxBrainKit
import AppKit
import SwiftUI

// Dev/verification helper: SB_SNAPSHOT_DIR=/tmp/shots ./SandboxBrain launches
// the real window in demo mode, walks every section, captures the window's own
// content view to PNG (no Screen Recording permission needed), and exits.

enum SnapshotMode {
    static var directory: String? { ProcessInfo.processInfo.environment["SB_SNAPSHOT_DIR"] }

    @MainActor
    static func run(state: AppState) async {
        guard let directory else { return }
        let dir = URL(fileURLWithPath: directory, isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        // Onboarding first (before demo data kicks in).
        state.phase = .onboarding
        try? await Task.sleep(for: .milliseconds(900))
        capture(to: dir.appendingPathComponent("onboarding.png"))

        state.startDemo()
        await state.refresh()
        try? await Task.sleep(for: .milliseconds(500))

        for section in Section.allCases {
            state.forcedSection = section
            try? await Task.sleep(for: .milliseconds(700))
            capture(to: dir.appendingPathComponent("\(section.rawValue.lowercased()).png"))
        }
        print("Snapshots written to \(dir.path)")
        exit(0)
    }

    @MainActor
    private static func capture(to url: URL) {
        guard let window = NSApp.windows.first(where: { $0.isVisible && $0.frame.height > 200 }),
              let view = window.contentView,
              let layer = view.layer
        else { return }
        let scale = window.backingScaleFactor
        let size = view.bounds.size
        guard let context = CGContext(
            data: nil,
            width: Int(size.width * scale),
            height: Int(size.height * scale),
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
        ) else { return }
        context.scaleBy(x: scale, y: scale)
        layer.render(in: context)
        guard let cgImage = context.makeImage() else { return }
        let rep = NSBitmapImageRep(cgImage: cgImage)
        if let png = rep.representation(using: .png, properties: [:]) {
            try? png.write(to: url)
        }
    }
}
