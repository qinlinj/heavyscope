import XCTest
@testable import HeavyScopeCore

final class SnapshotStoreTests: XCTestCase {
    func testRecordsChangeAndFifteenMinuteAnchor() throws {
        let store = try SnapshotStore(path: temporaryDB())
        let start = Date(timeIntervalSince1970: 1_788_940_800)
        let pool = LivePoolUpdate(
            poolHint: .cursorModels,
            quotaUsed: 10,
            recordedAt: start
        )
        XCTAssertNotNil(try store.record(pool, now: start))
        XCTAssertNil(try store.record(pool, now: start.addingTimeInterval(60)))
        XCTAssertNotNil(try store.record(pool, now: start.addingTimeInterval(15 * 60)))
        let changed = LivePoolUpdate(poolHint: .cursorModels, quotaUsed: 12, recordedAt: start)
        XCTAssertNotNil(try store.record(changed, now: start.addingTimeInterval(16 * 60)))
        let series = try store.series(
            pool: .cursorModels,
            from: start.addingTimeInterval(-1),
            to: start.addingTimeInterval(20 * 60)
        )
        XCTAssertEqual(series.count, 3)
        XCTAssertEqual(series[1].isAnchor, true)
        XCTAssertEqual(series[2].usedPercent, 12)
    }

    func testDailyActivityAndHeatmapAreHonestWhenEmpty() throws {
        let store = try SnapshotStore(path: temporaryDB())
        let activity = try store.dailyActivity(
            from: Date(timeIntervalSince1970: 1_788_940_800),
            to: Date(timeIntervalSince1970: 1_789_027_200)
        )
        XCTAssertTrue(activity.isEmpty)
        let cells = try store.heatmap(weeks: 2, ending: Date(timeIntervalSince1970: 1_789_027_200))
        XCTAssertEqual(cells.count, 14)
        XCTAssertTrue(cells.allSatisfy { $0.intensity == 0 && $0.sampleCount == 0 })
    }

    func testDailyActivityDoesNotMixUSDAndPercent() {
        XCTAssertEqual(MenuBarIndicator.combinedUnit(["%", "%"]), "%")
        XCTAssertNil(MenuBarIndicator.combinedUnit(["%", "USD"]))
        XCTAssertEqual(MenuBarIndicator.combinedUnit(["USD"]), "USD")
    }

    func testIdealPaceIsLinearAndNotInventedUsage() {
        let store = try! SnapshotStore(path: temporaryDB())
        XCTAssertEqual(store.idealPace(steps: 5), [100, 75, 50, 25, 0])
    }

    func testTightestRingUsesHighestUsedPercent() {
        let pools = [
            LivePoolUpdate(poolHint: .cursorModels, quotaUsed: 7),
            LivePoolUpdate(poolHint: .cursorOther, quotaUsed: 0),
            LivePoolUpdate(poolHint: .grokBot, quotaUsed: 36),
        ]
        let rings = MenuBarIndicator.rings(pools: pools)
        XCTAssertEqual(rings.label, .grokBot)
        XCTAssertEqual(rings.outerRemaining, 64)
    }

    private func temporaryDB() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("heavyscope-test-\(UUID().uuidString).sqlite")
    }
}
