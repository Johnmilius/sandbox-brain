// Renders AppIcon.icns: white brain glyph on the v2 ink rounded-rect.
// Run: swift tools/make-icon.swift  (writes Resources/AppIcon.icns)
import AppKit

let sizes = [16, 32, 64, 128, 256, 512, 1024]
let tmp = URL(fileURLWithPath: "build/AppIcon.iconset")
try? FileManager.default.removeItem(at: tmp)
try! FileManager.default.createDirectory(at: tmp, withIntermediateDirectories: true)

for size in sizes {
    let s = CGFloat(size)
    let image = NSImage(size: NSSize(width: s, height: s))
    image.lockFocus()

    let inset = s * 0.05
    let rect = NSRect(x: inset, y: inset, width: s - inset * 2, height: s - inset * 2)
    let path = NSBezierPath(roundedRect: rect, xRadius: s * 0.22, yRadius: s * 0.22)
    NSColor(calibratedRed: 0x1C / 255, green: 0x1C / 255, blue: 0x1F / 255, alpha: 1).setFill()
    path.fill()

    let config = NSImage.SymbolConfiguration(pointSize: s * 0.45, weight: .medium)
    if let symbol = NSImage(systemSymbolName: "brain.fill", accessibilityDescription: nil)?
        .withSymbolConfiguration(config) {
        let tinted = NSImage(size: symbol.size)
        tinted.lockFocus()
        symbol.draw(at: .zero, from: .zero, operation: .sourceOver, fraction: 1)
        NSColor.white.set()
        NSRect(origin: .zero, size: symbol.size).fill(using: .sourceAtop)
        tinted.unlockFocus()
        let symbolSize = tinted.size
        let origin = NSPoint(x: (s - symbolSize.width) / 2, y: (s - symbolSize.height) / 2)
        tinted.draw(at: origin, from: .zero, operation: .sourceOver, fraction: 1)
    }

    image.unlockFocus()

    guard let tiff = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let png = rep.representation(using: .png, properties: [:]) else { continue }
    try! png.write(to: tmp.appendingPathComponent("icon_\(size)x\(size).png"))
    if size <= 512 {
        try! png.write(to: tmp.appendingPathComponent("icon_\(size / 2)x\(size / 2)@2x.png"))
    }
}

let task = Process()
task.launchPath = "/usr/bin/iconutil"
task.arguments = ["-c", "icns", tmp.path, "-o", "Resources/AppIcon.icns"]
task.launch()
task.waitUntilExit()
print(task.terminationStatus == 0 ? "Wrote Resources/AppIcon.icns" : "iconutil failed")
