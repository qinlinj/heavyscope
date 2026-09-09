import XCTest
@testable import HeavyScopeCore

final class NativeMacMappingTests: XCTestCase {
    func testPresetIdsMatchWebPresets() {
        XCTAssertEqual(PoolHint.cursorModels.presetId, "preset-cursor-models")
        XCTAssertEqual(PoolHint.cursorOther.presetId, "preset-cursor-other")
        XCTAssertEqual(PoolHint.grokBot.presetId, "preset-grok-bot")
        XCTAssertEqual(PoolHint.grokHeavy.presetId, "preset-grok-heavy")
        XCTAssertEqual(NativeMacMapping.hint(forPresetId: "preset-cursor-other"), .cursorOther)
    }

    func testAcceptedFieldsMatchCodingBotMap() {
        XCTAssertEqual(NativeMacMapping.modelsField, "autoPercentUsed")
        XCTAssertEqual(NativeMacMapping.otherField, "apiPercentUsed")
        XCTAssertEqual(NativeMacMapping.botField, "usagePercent")
        XCTAssertEqual(NativeMacMapping.heavyJSONField, "creditUsagePercent")
        XCTAssertEqual(NativeMacMapping.heavyProtoField, 1)
        XCTAssertEqual(NativeMacMapping.heavyProtoWire, 5)
        XCTAssertNotEqual(NativeMacMapping.otherField, "totalSpend")
        XCTAssertNotEqual(NativeMacMapping.otherField, NativeMacMapping.modelsField)
        XCTAssertEqual(NativeMacMapping.includedCapCopyCents, 40_000)
        XCTAssertEqual(NativeMacMapping.sandPath, "/api/dashboard/get-sand-usage-status")
        XCTAssertEqual(NativeMacMapping.periodPath, "/api/dashboard/get-current-period-usage")
        XCTAssertEqual(NativeMacMapping.summaryPath, "/api/usage-summary")
    }
}
