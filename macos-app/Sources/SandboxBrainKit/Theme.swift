import SwiftUI
#if os(macOS)
import AppKit
#elseif os(iOS)
import UIKit
#endif

// V2 design tokens (docs/v2/DESIGN-SPEC.md) translated for a native surface.
// Light-first like the web app, with Liquid Glass cards over the cream field.

public enum Brand {
    /// Adaptive token: light-mode value / dark-mode value (sRGB 0–255).
    private static func dynamic(_ light: (Double, Double, Double), _ dark: (Double, Double, Double)) -> Color {
        #if os(macOS)
        Color(nsColor: NSColor(name: nil) { appearance in
            let c = appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua ? dark : light
            return NSColor(srgbRed: c.0 / 255, green: c.1 / 255, blue: c.2 / 255, alpha: 1)
        })
        #else
        Color(uiColor: UIColor { traits in
            let c = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: c.0 / 255, green: c.1 / 255, blue: c.2 / 255, alpha: 1)
        })
        #endif
    }

    // v2 palette, light-first with a faithful dark inversion.
    public static let ink = dynamic((0x1C, 0x1C, 0x1F), (0xF2, 0xF1, 0xEF))          // text
    public static let cream = dynamic((0xFA, 0xF9, 0xF7), (0x15, 0x15, 0x17))        // page field
    public static let surface = dynamic((0xFF, 0xFF, 0xFF), (0x20, 0x20, 0x23))      // flat cards
    public static let accentField = dynamic((0xEF, 0xEC, 0xE7), (0x23, 0x23, 0x26))  // wells/tracks
    public static let border = dynamic((0xED, 0xED, 0xEB), (0x2C, 0x2C, 0x30))
    public static let mutedText = dynamic((0x78, 0x71, 0x6C), (0xA8, 0xA2, 0x9E))
    public static let purple = dynamic((0x5B, 0x3F, 0xD6), (0x8B, 0x74, 0xF0))       // chart / identity
    public static let green = Color(red: 0x16 / 255, green: 0xA3 / 255, blue: 0x4A / 255) // running-timer dot

    /// Fixed ink for brand marks and prominent buttons — identical in both
    /// modes so the identity doesn't invert.
    public static let inkSolid = Color(red: 0x1C / 255, green: 0x1C / 255, blue: 0x1F / 255)

    /// Stable identity color per profile (John black, Luke purple, extras cycle).
    public static func identity(_ profileId: String, profiles: [Profile]) -> Color {
        let palette: [Color] = [ink, purple, Color(red: 0.85, green: 0.44, blue: 0.20), Color(red: 0.13, green: 0.52, blue: 0.62)]
        let index = profiles.firstIndex { $0.id == profileId } ?? 0
        return palette[index % palette.count]
    }

    public static func status(_ s: ProjectStatus) -> Color {
        switch s {
        case .active: green
        case .paused: Color.orange
        case .completed: purple
        case .archived: mutedText
        }
    }

    public static func priority(_ p: TaskPriority) -> Color {
        switch p {
        case .high: Color(red: 0.86, green: 0.22, blue: 0.22)
        case .med: Color.orange
        case .low: mutedText
        }
    }
}

// MARK: - Reusable pieces

/// Newsreader-style serif page heading.
public struct PageTitle: View {
    let text: String

    public init(text: String) {
        self.text = text
    }

    public var body: some View {
        Text(text)
            .font(.system(size: 30, weight: .medium, design: .serif))
            .foregroundStyle(Brand.ink)
    }
}

/// 10px uppercase mono label (the Geist Mono chip from v2).
public struct MonoLabel: View {
    let text: String

    public init(text: String) {
        self.text = text
    }

    public var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .medium, design: .monospaced))
            .tracking(1.2)
            .foregroundStyle(Brand.mutedText)
    }
}

/// Liquid Glass card — the app's standard surface.
public struct GlassCard<Content: View>: View {
    var padding: CGFloat = 16
    @ViewBuilder var content: Content

    public init(padding: CGFloat = 16, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.content = content()
    }

    public var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            // Tinted, not bare: Liquid Glass samples the backdrop *behind the
            // window*, so an untinted card transmits whatever is on the user's
            // desktop — two cards side by side pick up different wallpaper
            // colors and read as stray gradients. The surface tint keeps the
            // glass depth and highlights while holding the card's own color.
            .glassEffect(
                .regular.tint(Brand.surface.opacity(0.72)),
                in: .rect(cornerRadius: 16)
            )
    }
}

/// Flat white card with the v2 hairline border — for small, dense cards
/// (kanban tiles, list rows) where per-card glass shadows would stack.
public struct FlatCard<Content: View>: View {
    var padding: CGFloat = 12
    @ViewBuilder var content: Content

    public init(padding: CGFloat = 12, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.content = content()
    }

    public var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Brand.surface, in: .rect(cornerRadius: 13))
            .overlay(
                RoundedRectangle(cornerRadius: 13)
                    .strokeBorder(Brand.border, lineWidth: 1)
            )
    }
}

public struct StatusPill: View {
    let label: String
    let color: Color

    public init(label: String, color: Color) {
        self.label = label
        self.color = color
    }

    public var body: some View {
        Text(label.uppercased())
            .font(.system(size: 9, weight: .semibold, design: .monospaced))
            .tracking(0.8)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.12), in: .capsule)
            .foregroundStyle(color)
    }
}

public struct AvatarView: View {
    let profile: Profile?
    var size: CGFloat = 26
    var color: Color = Brand.ink

    public init(profile: Profile?, size: CGFloat = 26, color: Color = Brand.ink) {
        self.profile = profile
        self.size = size
        self.color = color
    }

    public var body: some View {
        Group {
            if let urlString = profile?.avatarUrl, let url = URL(string: urlString) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    initialsCircle
                }
            } else {
                initialsCircle
            }
        }
        .frame(width: size, height: size)
        .clipShape(.circle)
    }

    private var initialsCircle: some View {
        ZStack {
            Circle().fill(color.opacity(0.15))
            Text(profile?.initials ?? "?")
                .font(.system(size: size * 0.38, weight: .semibold))
                .foregroundStyle(color)
        }
    }
}

public struct EmptyStateView: View {
    let symbol: String
    let title: String
    let message: String

    public init(symbol: String, title: String, message: String) {
        self.symbol = symbol
        self.title = title
        self.message = message
    }

    public var body: some View {
        VStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 30))
                .foregroundStyle(Brand.mutedText)
            Text(title)
                .font(.system(size: 16, weight: .semibold, design: .serif))
                .foregroundStyle(Brand.ink)
            Text(message)
                .font(.system(size: 12))
                .foregroundStyle(Brand.mutedText)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }
}

/// Standard scrollable page scaffold: serif title + mono kicker + content.
public struct Page<Content: View>: View {
    let kicker: String
    let title: String
    var trailing: AnyView? = nil
    /// Dashboard mode: content is at least as tall as the window, so it fills a
    /// large display instead of stranding dead space below — but it still lives
    /// in a ScrollView, so a short or resized window scrolls rather than
    /// clipping. Reading-length sections (a note, a form) keep the default.
    var fills: Bool = false
    /// Wider clamp for two-column dashboards; reading content stays at 980.
    var maxContentWidth: CGFloat = 980
    @ViewBuilder var content: Content

    public init(
        kicker: String,
        title: String,
        trailing: AnyView? = nil,
        fills: Bool = false,
        maxContentWidth: CGFloat = 980,
        @ViewBuilder content: () -> Content
    ) {
        self.kicker = kicker
        self.title = title
        self.trailing = trailing
        self.fills = fills
        self.maxContentWidth = maxContentWidth
        self.content = content()
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 4) {
                MonoLabel(text: kicker)
                PageTitle(text: title)
            }
            Spacer()
            trailing
        }
    }

    public var body: some View {
        Group {
            if fills {
                // minHeight (not maxHeight) is the whole trick: the content
                // stretches to fill a tall window, and anything taller than the
                // window scrolls instead of being cut off. Works at any size the
                // user drags the window to, in both directions.
                GeometryReader { geo in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 22) {
                            header
                            content
                        }
                        .padding(24)
                        .frame(maxWidth: maxContentWidth, alignment: .leading)
                        .frame(maxWidth: .infinity, minHeight: geo.size.height, alignment: .top)
                    }
                }
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        header
                        content
                    }
                    .padding(24)
                    .frame(maxWidth: maxContentWidth, alignment: .leading)
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .background(Brand.cream)
    }
}
