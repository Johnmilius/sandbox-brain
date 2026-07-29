import Foundation
import Testing

@testable import SandboxBrain

// Pure formatting / date helpers ported from the web app (format.ts, growth.ts,
// home-digest.ts). Deterministic: every helper takes an injectable `now`, and
// dates are built via Calendar.current so the assertions hold in any timezone.

@Suite struct SupportTests {

    // MARK: parseISO

    @Test func parseISOReadsFractionalAndPlain() {
        // Round-trips through the fractional formatter used everywhere.
        let d = Date(timeIntervalSince1970: 1_700_000_000)
        #expect(abs(parseISO(iso(d)).timeIntervalSince(d)) < 0.001)
        // Plain ISO (no fractional seconds) still parses.
        #expect(parseISO("2026-07-15T12:00:00Z") != .distantPast)
    }

    @Test func parseISOFallsBackToDistantPastOnGarbage() {
        #expect(parseISO("not-a-date") == .distantPast)
        #expect(parseISO("") == .distantPast)
    }

    // MARK: durations

    @Test func entryDurationUsesEndWhenPresent() {
        let start = Date(timeIntervalSince1970: 1_000_000)
        let end = start.addingTimeInterval(90) // 90s
        let ms = entryDurationMs(startedAt: iso(start), endedAt: iso(end))
        #expect(abs(ms - 90_000) < 2)
    }

    @Test func entryDurationUsesNowWhenRunning() {
        let start = Date(timeIntervalSince1970: 1_000_000)
        let now = start.addingTimeInterval(120) // 2m later
        let ms = entryDurationMs(startedAt: iso(start), endedAt: nil, now: now)
        #expect(abs(ms - 120_000) < 2)
    }

    @Test func entryDurationClampsNegativeToZero() {
        let start = Date(timeIntervalSince1970: 1_000_000)
        let earlier = start.addingTimeInterval(-60)
        #expect(entryDurationMs(startedAt: iso(start), endedAt: iso(earlier)) == 0)
    }

    // MARK: formatting

    @Test func formatHoursIsOneDecimal() {
        #expect(formatHours(ms: 3_600_000) == "1.0h")
        #expect(formatHours(ms: 5_400_000) == "1.5h")
        #expect(formatHours(ms: 0) == "0.0h")
    }

    @Test func formatClockOmitsHoursUnderAnHour() {
        #expect(formatClock(ms: 0) == "00:00")
        #expect(formatClock(ms: 65_000) == "01:05")
        #expect(formatClock(ms: 3_661_000) == "1:01:01")
    }

    // MARK: relative time (offsets sit off exact boundaries to avoid rounding flips)

    @Test func relativeTimeBuckets() {
        let now = Date(timeIntervalSince1970: 2_000_000)
        func rel(_ secondsAgo: Double) -> String { relativeTime(iso(now.addingTimeInterval(-secondsAgo)), now: now) }
        #expect(rel(45) == "just now")
        #expect(rel(14 * 60 + 10) == "14m ago")
        #expect(rel(3 * 3600 + 300) == "3h ago")
        #expect(rel(2 * 86_400 + 3600) == "2d ago")
    }

    // MARK: greeting (built at a known local hour)

    @Test func greetingByLocalHour() {
        func at(_ hour: Int) -> Date {
            var c = DateComponents()
            c.year = 2026; c.month = 7; c.day = 15; c.hour = hour; c.minute = 30
            return Calendar.current.date(from: c)!
        }
        #expect(greeting(now: at(9)) == "Good morning")
        #expect(greeting(now: at(14)) == "Good afternoon")
        #expect(greeting(now: at(20)) == "Good evening")
    }

    // MARK: week / day helpers

    @Test func weekStartIsLocalMondayMidnight() {
        let d = Date(timeIntervalSince1970: 1_752_000_000) // arbitrary
        let start = weekStartLocal(d)
        let cal = Calendar.current
        #expect(cal.component(.weekday, from: start) == 2) // Monday
        #expect(cal.startOfDay(for: start) == start)        // midnight
        #expect(start <= d)
        #expect(d.timeIntervalSince(start) < 7 * 86_400)    // within the week
    }

    @Test func dayBucketsAreAscendingAndEndToday() {
        let now = Date(timeIntervalSince1970: 1_752_000_000)
        let buckets = dayBuckets(count: 5, now: now)
        #expect(buckets.count == 5)
        // strictly ascending starts
        for i in 1..<buckets.count {
            #expect(buckets[i].start > buckets[i - 1].start)
        }
        // only the last bucket is today, and it starts at local midnight of `now`
        #expect(buckets.last?.isToday == true)
        #expect(buckets.dropLast().allSatisfy { !$0.isToday })
        #expect(buckets.last?.start == Calendar.current.startOfDay(for: now))
    }
}
