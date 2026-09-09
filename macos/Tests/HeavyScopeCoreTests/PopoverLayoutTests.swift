import XCTest
@testable import HeavyScopeCore

final class PopoverLayoutTests: XCTestCase {
    func testPopoverOrderIsModelsOtherBotHeavy() {
        XCTAssertEqual(PoolHint.popoverOrder, [.cursorModels, .cursorOther, .grokBot, .grokHeavy])
        XCTAssertEqual(PoolHint.popoverOrder.count, 4)
    }

    func testUnconnectedPoolsNeverDriveTheIcon() {
        let lastGood = [
            LivePoolUpdate(poolHint: .cursorModels, quotaUsed: 8),
            LivePoolUpdate(poolHint: .cursorOther, quotaUsed: 0),
        ]
        let rings = MenuBarIndicator.rings(
            pools: lastGood + [LivePoolUpdate(poolHint: .grokHeavy, quotaUsed: 90)],
            connectedHints: [.cursorModels, .cursorOther]
        )
        XCTAssertEqual(rings.label, .cursorModels)
        XCTAssertEqual(rings.outerRemaining, 92)
        XCTAssertNotEqual(rings.label, .grokHeavy)
    }

    func testIconUsesTightestConnectedRemainingAndKeepsLastGood() {
        let stale = [
            LivePoolUpdate(poolHint: .grokBot, quotaUsed: 36),
            LivePoolUpdate(poolHint: .cursorModels, quotaUsed: 7),
        ]
        let rings = MenuBarIndicator.rings(pools: stale)
        XCTAssertEqual(rings.label, .grokBot)
        XCTAssertEqual(rings.outerRemaining, 64)
        XCTAssertEqual(MenuBarIndicator.remainingLabel(rings.outerRemaining), "64%")
        XCTAssertEqual(MenuBarIndicator.usedLabel(rings.usedPercent), "36%")
    }

    func testEmptyConnectedSetLeavesIconBlank() {
        let rings = MenuBarIndicator.rings(pools: [], connectedHints: [])
        XCTAssertNil(rings.outerRemaining)
        XCTAssertNil(rings.label)
        XCTAssertEqual(MenuBarIndicator.remainingLabel(nil), "—")
    }
}
