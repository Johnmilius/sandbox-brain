import Foundation

// MARK: - Connection config (Application Support, not Keychain)
//
// The project URL and anon key are PUBLIC values — the website hands them to
// every visitor's browser — so a plain config file is appropriate. Keychain
// was worse here: ad-hoc-signed builds get a new identity on every rebuild,
// which orphans keychain items. Auth sessions (the actually-sensitive part)
// are stored separately by supabase-swift.

enum ConfigStore {
    struct Config: Codable {
        var supabaseURL: String
        var anonKey: String
    }

    private static var fileURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Sandbox Brain/config.json")
    }

    static func load() -> Config? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? JSONDecoder().decode(Config.self, from: data)
    }

    static func save(_ config: Config) {
        let dir = fileURL.deletingLastPathComponent()
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        if let data = try? JSONEncoder().encode(config) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }

    static func clear() {
        try? FileManager.default.removeItem(at: fileURL)
    }
}

// MARK: - ISO timestamps (stored as strings, parsed lazily — mirrors the web app)

// ISO8601DateFormatter is documented thread-safe; Swift 6 can't see that.
nonisolated(unsafe) private let isoFractional: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()

nonisolated(unsafe) private let isoPlain: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f
}()

public func parseISO(_ s: String) -> Date {
    isoFractional.date(from: s) ?? isoPlain.date(from: s) ?? .distantPast
}

public func isoNow() -> String { isoFractional.string(from: Date()) }
public func iso(_ d: Date) -> String { isoFractional.string(from: d) }

// MARK: - Duration / date formatting (ports src/lib/format.ts + home-digest.ts)

public func entryDurationMs(startedAt: String, endedAt: String?, now: Date = Date()) -> Double {
    let start = parseISO(startedAt)
    let end = endedAt.map(parseISO) ?? now
    return max(0, end.timeIntervalSince(start) * 1000)
}

public func formatHours(ms: Double) -> String {
    let hours = ms / 3_600_000
    return String(format: "%.1fh", hours)
}

/// One entry's length, at the precision a person would say it out loud: minutes
/// below an hour, hours above. `formatHours` is for aggregates ("121.8h across
/// the team"), where decimal hours are the right unit — but it renders a
/// six-minute timer as "0.0h", which reads as a bug in a feed row.
public func formatSpan(ms: Double) -> String {
    let minutes = ms / 60_000
    if minutes < 1 { return "<1m" }
    if minutes < 60 { return "\(Int(minutes.rounded()))m" }
    let hours = ms / 3_600_000
    // Whole hours lose the decimal: "2h", not "2.0h".
    return hours == hours.rounded()
        ? "\(Int(hours))h"
        : String(format: "%.1fh", hours)
}

public func formatClock(ms: Double) -> String {
    let total = Int(ms / 1000)
    let h = total / 3600, m = (total % 3600) / 60, s = total % 60
    return h > 0
        ? String(format: "%d:%02d:%02d", h, m, s)
        : String(format: "%02d:%02d", m, s)
}

/// Compact relative time: "just now", "14m ago", "3h ago", "2d ago".
public func relativeTime(_ isoString: String, now: Date = Date()) -> String {
    let ms = now.timeIntervalSince(parseISO(isoString))
    if ms < 60 { return "just now" }
    let minutes = Int(ms / 60)
    if minutes < 60 { return "\(minutes)m ago" }
    let hours = minutes / 60
    if hours < 24 { return "\(hours)h ago" }
    return "\(hours / 24)d ago"
}

/// "Good morning" | "Good afternoon" | "Good evening" (local hour).
public func greeting(now: Date = Date()) -> String {
    let hour = Calendar.current.component(.hour, from: now)
    if hour < 12 { return "Good morning" }
    if hour < 18 { return "Good afternoon" }
    return "Good evening"
}

/// Mono date stamp, e.g. "MON · JUL 6" (local).
public func monoDate(now: Date = Date()) -> String {
    let f = DateFormatter()
    f.dateFormat = "EEE"
    let weekday = f.string(from: now).uppercased()
    f.dateFormat = "MMM"
    let month = f.string(from: now).uppercased()
    let day = Calendar.current.component(.day, from: now)
    return "\(weekday) · \(month) \(day)"
}

/// Local midnight on the Monday of the week containing `d` (ports growth.ts).
public func weekStartLocal(_ d: Date = Date()) -> Date {
    let cal = Calendar.current
    let weekday = cal.component(.weekday, from: d) // 1 = Sunday … 7 = Saturday
    let sinceMonday = (weekday + 5) % 7
    let midnight = cal.startOfDay(for: d)
    return cal.date(byAdding: .day, value: -sinceMonday, to: midnight)!
}

/// The last `count` local calendar days ending today, ascending (start, isToday, letter).
public func dayBuckets(count: Int = 7, now: Date = Date()) -> [(start: Date, end: Date, letter: String, isToday: Bool)] {
    let cal = Calendar.current
    let today = cal.startOfDay(for: now)
    let f = DateFormatter()
    f.dateFormat = "EEEEE" // narrow weekday letter
    return (0..<count).map { i in
        let start = cal.date(byAdding: .day, value: -(count - 1 - i), to: today)!
        let end = cal.date(byAdding: .day, value: 1, to: start)!
        return (start, end, f.string(from: start), start == today)
    }
}
