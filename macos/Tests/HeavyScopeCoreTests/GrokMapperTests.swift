import XCTest
@testable import HeavyScopeCore

final class GrokMapperTests: XCTestCase {
    func testCLIBillingMapsHeavyFromCreditUsagePercent() {
        let result = GrokMapper.mapCLIBillingJSON(JSONValue.wrap([
            "config": [
                "creditUsagePercent": 12.5,
                "currentPeriod": [
                    "end": "2026-08-24T00:00:00.000Z",
                ],
                "productUsage": [
                    ["product": "GROK_CHAT", "usagePercent": 12],
                ],
            ],
        ]))
        XCTAssertTrue(result.ok)
        XCTAssertEqual(result.pool(.grokHeavy)?.quotaUsed, 12.5)
        XCTAssertEqual(result.pool(.grokHeavy)?.quotaTotal, 100)
        XCTAssertEqual(result.pool(.grokHeavy)?.unit, "%")
        XCTAssertNil(result.pool(.grokBot), "grok.com GROK_CHAT is not Grok Bot")
        XCTAssertTrue(result.botUnavailable)
    }

    func testProtoWalkerReadsFixed32HeavyPercent() {
        var payload = Data()
        payload.append(contentsOf: [0x0D]) // field 1, wire 5
        var percent = Float32(18.25)
        withUnsafeBytes(of: &percent) { payload.append(contentsOf: $0) }
        var frame = Data([0, 0, 0, 0, UInt8(payload.count)])
        frame.append(payload)
        let result = GrokMapper.parseCreditsPayload(frame)
        XCTAssertTrue(result.ok)
        XCTAssertEqual(result.pool(.grokHeavy)?.quotaUsed ?? 0, 18.25, accuracy: 0.0001)
        XCTAssertNil(result.pool(.grokBot))
    }

    func testHTTP401IsExpiredNotInventedHeavy() {
        let result = GrokMapper.mapCreditsResponse(status: 401, body: Data())
        XCTAssertFalse(result.ok)
        XCTAssertEqual(result.code, .expired)
        XCTAssertTrue(result.pools.isEmpty)
    }
}
