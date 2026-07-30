import SwiftUI

// V2 design tokens (docs/v2/DESIGN-SPEC.md) translated for a native surface.
// Light-first like the web app, with Liquid Glass cards over the cream field.

enum Brand {
    /// Adaptive token: light-mode value / dark-mode value (sRGB 0–255).
    private static func dynamic(_ light: (Double, Double, Double), _ dark: (Double, Double, Double)) -> Color {
        Color(nsColor: NSColor(name: nil) { appearance in
            let c = appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua ? dark : light
            return NSColor(srgbRed: c.0 / 255, green: c.1 / 255, blue: c.2 / 255, alpha: 1)
        })
    }

    // v2 palette, light-first with a faithful dark inversion.
    static let ink = dynamic((0x1C, 0x1C, 0x1F), (0xF2, 0xF1, 0xEF))          // text
    static let cream = dynamic((0xFA, 0xF9, 0xF7), (0x15, 0x15, 0x17))        // page field
    static let surface = dynamic((0xFF, 0xFF, 0xFF), (0x20, 0x20, 0x23))      // flat cards
    static let accentField = dynamic((0xEF, 0xEC, 0xE7), (0x23, 0x23, 0x26))  // wells/tracks
    static let border = dynamic((0xED, 0xED, 0xEB), (0x2C, 0x2C, 0x30))
    static let mutedText = dynamic((0x78, 0x71, 0x6C), (0xA8, 0xA2, 0x9E))
    static let purple = dynamic((0x5B, 0x3F, 0xD6), (0x8B, 0x74, 0xF0))       // chart / identity
    static let green = Color(red: 0x16 / 255, green: 0xA3 / 255, blue: 0x4A / 255) // running-timer dot

    /// Fixed ink for brand marks and prominent buttons — identical in both
    /// modes so the identity doesn't invert.
    static let inkSolid = Color(red: 0x1C / 255, green: 0x1C / 255, blue: 0x1F / 255)

    /// Stable identity color per profile (John black, Luke purple, extras cycle).
    static func identity(_ profileId: String, profiles: [Profile]) -> Color {
        let palette: [Color] = [ink, purple, Color(red: 0.85, green: 0.44, blue: 0.20), Color(red: 0.13, green: 0.52, blue: 0.62)]
        let index = profiles.firstIndex { $0.id == profileId } ?? 0
        return palette[index % palette.count]
    }

    static func status(_ s: ProjectStatus) -> Color {
        switch s {
        case .active: green
        case .paused: Color.orange
        case .completed: purple
        case .archived: mutedText
        }
    }

    static func priority(_ p: TaskPriority) -> Color {
        switch p {
        case .high: Color(red: 0.86, green: 0.22, blue: 0.22)
        case .med: Color.orange
        case .low: mutedText
        }
    }
}

// MARK: - Reusable pieces

/// Newsreader-style serif page heading.
struct PageTitle: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.system(size: 30, weight: .medium, design: .serif))
            .foregroundStyle(Brand.ink)
    }
}

/// 10px uppercase mono label (the Geist Mono chip from v2).
struct MonoLabel: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .medium, design: .monospaced))
            .tracking(1.2)
            .foregroundStyle(Brand.mutedText)
    }
}

/// Liquid Glass card — the app's standard surface.
struct GlassCard<Content: View>: View {
    var padding: CGFloat = 16
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .glassEffect(.regular, in: .rect(cornerRadius: 16))
    }
}

/// Flat white card with the v2 hairline border — for small, dense cards
/// (kanban tiles, list rows) where per-card glass shadows would stack.
struct FlatCard<Content: View>: View {
    var padding: CGFloat = 12
    @ViewBuilder var content: Content

    var body: some View {
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

struct StatusPill: View {
    let label: String
    let color: Color
    var body: some View {
        Text(label.uppercased())
            .font(.system(size: 9, weight: .semibold, design: .monospaced))
            .tracking(0.8)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.12), in: .capsule)
            .foregroundStyle(color)
    }
}

struct AvatarView: View {
    let profile: Profile?
    var size: CGFloat = 26
    var color: Color = Brand.ink

    var body: some View {
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

struct EmptyStateView: View {
    let symbol: String
    let title: String
    let message: String

    var body: some View {
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
struct Page<Content: View>: View {
    let kicker: String
    let title: String
    var trailing: AnyView? = nil
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 4) {
                        MonoLabel(text: kicker)
                        PageTitle(text: title)
                    }
                    Spacer()
                    trailing
                }
                content
            }
            .padding(24)
            .frame(maxWidth: 980, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(Brand.cream)
    }
}
