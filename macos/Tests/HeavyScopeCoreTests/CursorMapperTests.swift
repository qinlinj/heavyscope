import XCTest
@testable import HeavyScopeCore

final class CursorMapperTests: XCTestCase {
    private let teamIDRequiredBody = """
    {"error":{"message":"Team ID is required","details":[{"error":"ERROR_UNAUTHORIZED"}]}}
    """

    private var sampleSummary: JSONValue {
        json([
            "billingCycleStart": "2026-07-19T00:00:00.000Z",
            "billingCycleEnd": "2026-08-19T00:00:00.000Z",
            "membershipType": "ultra",
            "individualUsage": [
                "plan": [
                    "autoPercentUsed": 42.5,
                    "apiPercentUsed": 18,
                    "totalPercentUsed": 40,
                ],
                "onDemand": ["enabled": true, "used": 1250, "limit": 40000],
            ],
        ])
    }

    private var livePeriod: JSONValue {
        json([
            "billingCycleStart": "2026-08-17T00:52:00.000Z",
            "billingCycleEnd": "2026-09-17T00:52:00.000Z",
            "membershipType": "ultra",
            "planUsage": [
                "autoPercentUsed": 7.2995,
                "apiPercentUsed": 0,
                "totalSpend": 14599,
                "includedSpend": 14599,
                "limit": 40000,
                "used": 0,
                "displayMessage": "You've used 36% of your included usage",
            ],
        ])
    }

    private var liveSummary: JSONValue {
        json([
            "billingCycleStart": "2026-08-17T00:52:00.000Z",
            "billingCycleEnd": "2026-09-17T00:52:00.000Z",
            "membershipType": "ultra",
            "individualUsage": [
                "plan": [
                    "autoPercentUsed": 7.2995,
                    "apiPercentUsed": 0,
                    "used": 14599,
                    "limit": 40000,
                ],
                "onDemand": ["enabled": false, "used": 0, "limit": NSNull()],
            ],
        ])
    }

    private var samplePeriod: JSONValue {
        json([
            "billingCycleStart": 1_752_883_200_000,
            "billingCycleEnd": 1_755_561_600_000,
            "planUsage": [
                "autoPercentUsed": 42.5,
                "apiPercentUsed": 18,
                "totalPercentUsed": 40,
                "totalSpend": 1250,
                "includedSpend": 1000,
                "bonusSpend": 250,
                "limit": 40000,
            ],
        ])
    }

    private var liveSand: JSONValue {
        json([
            "usagePercent": 36.327845,
            "currentPeriodStart": "2026-08-17T01:40:00.748Z",
            "nextResetTimestampUtc": "2026-08-24T01:40:00.748Z",
            "hasAvailableUsage": true,
            "hasNonZeroIncludedLimit": true,
        ])
    }

    private var sampleSand: JSONValue {
        json([
            "usagePercent": 21.473078,
            "currentPeriodStart": "2026-08-17T01:40:00.748Z",
            "nextResetTimestampUtc": "2026-08-24T01:40:00.748Z",
            "hasAvailableUsage": true,
            "hasNonZeroIncludedLimit": true,
        ])
    }

    private var noBotAggregations: JSONValue {
        json([
            "aggregations": [
                ["modelIntent": "sand-default"],
                ["modelIntent": "cursor-grok-4.6-high-fast"],
                ["modelIntent": "claude-opus-5-low"],
                ["modelIntent": "sand-automation"],
                ["modelIntent": "gemini-2.5-flash"],
            ],
        ])
    }

    func testOtherIsApiPercentUsedNotTotalSpend() {
        let result = CursorMapper.mergeSpendingSources(period: livePeriod, summary: liveSummary)
        let models = result.pool(.cursorModels)
        let other = result.pool(.cursorOther)
        XCTAssertEqual(models?.quotaUsed, 7.2995)
        XCTAssertEqual(other?.quotaUsed, 0)
        XCTAssertEqual(other?.quotaTotal, 100)
        XCTAssertEqual(other?.unit, "%")
        XCTAssertEqual(other?.note, LiveConstants.otherSourceNote)
        XCTAssertNotEqual(other?.quotaUsed, 145.99)
        XCTAssertNotEqual(other?.quotaTotal, 400)
        XCTAssertNotEqual(other?.unit, "USD")
        XCTAssertFalse(result.pools.contains { $0.quotaUsed == 145.99 })
    }

    func testOtherZeroWhenTotalSpendIsPresent() {
        let result = CursorMapper.mergeSpendingSources(
            period: json([
                "planUsage": [
                    "autoPercentUsed": 7.2995,
                    "apiPercentUsed": 0,
                    "totalSpend": 14599,
                    "includedSpend": 14599,
                    "limit": 40000,
                ],
            ])
        )
        XCTAssertEqual(result.pool(.cursorOther)?.quotaUsed, 0)
        XCTAssertNotEqual(result.pool(.cursorOther)?.quotaUsed, 145.99)
        XCTAssertNotEqual(result.pool(.cursorOther)?.quotaUsed, 36)
    }

    func testMissingApiPercentDoesNotInventOtherFromTotalSpend() {
        let result = CursorMapper.mergeSpendingSources(
            period: json([
                "planUsage": [
                    "autoPercentUsed": 1,
                    "totalSpend": 14599,
                    "includedSpend": 14599,
                    "limit": 40000,
                ],
            ])
        )
        XCTAssertNil(result.pool(.cursorOther))
        XCTAssertEqual(result.pools.map(\.poolHint), [.cursorModels])
        XCTAssertFalse(result.pools.contains { $0.quotaUsed == 145.99 || $0.quotaTotal == 400 })
    }

    func testApiPercentTwelveIgnoresTotalSpendDollars() {
        let result = CursorMapper.mergeSpendingSources(
            period: json([
                "planUsage": [
                    "autoPercentUsed": 1,
                    "apiPercentUsed": 12,
                    "totalSpend": 14599,
                    "limit": 40000,
                ],
            ])
        )
        XCTAssertEqual(result.pool(.cursorOther)?.quotaUsed, 12)
        XCTAssertEqual(result.pool(.cursorOther)?.quotaTotal, 100)
        XCTAssertEqual(result.pool(.cursorOther)?.unit, "%")
    }

    func testModelsIsAutoPercentUsed() {
        let result = CursorMapper.mapUsageSummary(sampleSummary)
        let models = result.pool(.cursorModels)
        XCTAssertEqual(models?.quotaUsed, 42.5)
        XCTAssertEqual(models?.quotaTotal, 100)
        XCTAssertEqual(models?.unit, "%")
        XCTAssertEqual(models?.resetCycle, .monthly)
        XCTAssertEqual(models?.resetAt?.timeIntervalSince1970, ISODates.parse("2026-08-19T00:00:00.000Z")?.timeIntervalSince1970)
    }

    func testBotIsSandUsagePercent() {
        XCTAssertEqual(CursorMapper.sandUsageRequestBody(), "{}")
        let mapped = CursorMapper.mapSandUsage(sampleSand, recordedAt: ISODates.parse("2026-08-21T18:00:00.000Z")!)
        XCTAssertEqual(mapped?.poolHint, .grokBot)
        XCTAssertEqual(mapped?.quotaUsed, 21.473078)
        XCTAssertEqual(mapped?.quotaTotal, 100)
        XCTAssertEqual(mapped?.unit, "%")
        XCTAssertEqual(mapped?.resetCycle, .weekly)
        XCTAssertEqual(
            mapped?.resetAt?.timeIntervalSince1970 ?? 0,
            ISODates.parse("2026-08-24T01:40:00.748Z")?.timeIntervalSince1970 ?? 1,
            accuracy: 0.001
        )
        XCTAssertEqual(CursorMapper.sandRemainingPercent(21.473078), 78.526922, accuracy: 0.00001)
        XCTAssertEqual(CursorMapper.sandRemainingPercent(110), 0)
        XCTAssertEqual(CursorMapper.sandRemainingPercent(-5), 100)
    }

    func testSandDoesNotInventAbsoluteCounts() {
        let polluted = CursorMapper.mapSandUsage(json([
            "usagePercent": 21.473078,
            "nextResetTimestampUtc": "2026-08-24T01:40:00.748Z",
            "used": 999,
            "remaining": 1,
            "limit": 50,
            "includedLimitZero": false,
            "availableBankedResetCount": 3,
            "hasAvailableUsage": true,
            "hasNonZeroIncludedLimit": true,
        ]))
        XCTAssertEqual(polluted?.quotaUsed, 21.473078)
        XCTAssertEqual(polluted?.quotaTotal, 100)
        XCTAssertNotEqual(polluted?.quotaUsed, 999)
        XCTAssertNotEqual(polluted?.quotaTotal, 50)
        XCTAssertNil(CursorMapper.mapSandUsage(json([
            "hasAvailableUsage": true,
            "hasNonZeroIncludedLimit": true,
        ])))
    }

    func testLiveSandKeepsOtherAtZero() {
        let sandParsed = CursorMapper.parseJSONBody(
            status: 200,
            body: stringify(liveSand),
            label: "Cursor sand-usage-status"
        )
        let result = CursorMapper.finishLiveRefresh(
            period: livePeriod,
            summary: liveSummary,
            aggregations: noBotAggregations,
            sandParsed: sandParsed
        )
        XCTAssertTrue(result.ok)
        XCTAssertEqual(result.botUnavailable, false)
        XCTAssertEqual(result.pool(.cursorModels)?.quotaUsed, 7.2995)
        XCTAssertEqual(result.pool(.cursorOther)?.quotaUsed, 0)
        XCTAssertEqual(result.pool(.grokBot)?.quotaUsed, 36.327845)
        XCTAssertEqual(result.pool(.grokBot)?.quotaTotal, 100)
        XCTAssertEqual(result.pool(.grokBot)?.resetCycle, .weekly)
        XCTAssertFalse(result.pools.contains { $0.quotaUsed == 145.99 })
    }

    func testTeamID401IsNotSessionExpired() {
        XCTAssertFalse(CursorMapper.isSessionExpired(status: 401, body: teamIDRequiredBody))
        let mapped = CursorMapper.mapHTTPStatus(
            status: 401,
            label: "Cursor filtered-usage-events",
            body: teamIDRequiredBody
        )
        XCTAssertEqual(mapped?.ok, false)
        XCTAssertEqual(mapped?.code, .http)
        XCTAssertNotEqual(mapped?.code, .expired)
        XCTAssertEqual(CursorMapper.mapUsageResponse(status: 401, body: teamIDRequiredBody).code, .http)
    }

    func testEmpty401IsExpired() {
        XCTAssertTrue(CursorMapper.isSessionExpired(status: 401, body: ""))
        XCTAssertTrue(CursorMapper.isSessionExpired(status: 401, body: #"{"error":"nope"}"#))
        XCTAssertTrue(CursorMapper.isSessionExpired(status: 403, body: "forbidden"))
        XCTAssertEqual(CursorMapper.mapHTTPStatus(status: 401, label: "Cursor usage-summary", body: "")?.code, .expired)
        XCTAssertEqual(
            CursorMapper.mapHTTPStatus(status: 403, label: "Cursor usage-summary", body: #"{"error":"nope"}"#)?.code,
            .expired
        )
    }

    func test405IsHTTPNotExpired() {
        let body = #"{"error":"Method not allowed"}"#
        XCTAssertFalse(CursorMapper.isSessionExpired(status: 405, body: body))
        let mapped = CursorMapper.mapHTTPStatus(status: 405, label: "Cursor current-period-usage", body: body)
        XCTAssertEqual(mapped?.code, .http)
        XCTAssertTrue(mapped?.message.contains("Method not allowed") == true)
        XCTAssertEqual(CursorMapper.mapPeriodResponse(status: 405, body: body).code, .http)
        XCTAssertNotEqual(CursorMapper.mapAggregatedResponse(status: 405, body: body).code, .expired)
        XCTAssertEqual(CursorMapper.mapSandResponse(status: 405, body: body).code, .http)
        XCTAssertNotEqual(CursorMapper.mapSandResponse(status: 405, body: body).code, .expired)
        XCTAssertEqual(CursorMapper.mapSandResponse(status: 401, body: teamIDRequiredBody).code, .http)
    }

    func testFinishRefreshKeepsModelsOtherOnTeamID401() {
        let eventsParsed = CursorMapper.parseJSONBody(
            status: 401,
            body: teamIDRequiredBody,
            label: "Cursor filtered-usage-events"
        )
        XCTAssertEqual(eventsParsed.error?.code, .http)
        let result = CursorMapper.finishLiveRefresh(
            period: samplePeriod,
            aggregations: noBotAggregations,
            eventsParsed: eventsParsed
        )
        XCTAssertTrue(result.ok)
        XCTAssertEqual(result.botUnavailable, true)
        XCTAssertEqual(result.pool(.cursorModels)?.quotaUsed, 42.5)
        XCTAssertEqual(result.pool(.cursorOther)?.quotaUsed, 18)
        XCTAssertNil(result.pool(.grokBot))
    }

    func testFinishRefreshKeepsModelsOtherOnSand405() {
        let sandParsed = CursorMapper.parseJSONBody(
            status: 405,
            body: #"{"error":"Method not allowed"}"#,
            label: "Cursor sand-usage-status"
        )
        XCTAssertEqual(sandParsed.error?.code, .http)
        let result = CursorMapper.finishLiveRefresh(
            period: samplePeriod,
            aggregations: noBotAggregations,
            sandParsed: sandParsed
        )
        XCTAssertTrue(result.ok)
        XCTAssertNotEqual(result.code, .expired)
        XCTAssertEqual(result.botUnavailable, true)
        XCTAssertEqual(result.pool(.cursorModels)?.quotaUsed, 42.5)
        XCTAssertEqual(result.pool(.cursorOther)?.quotaUsed, 18)
        XCTAssertNil(result.pool(.grokBot))
    }

    func testDisabledOnDemandIsNotOther() {
        let result = CursorMapper.mapUsageSummary(json([
            "individualUsage": [
                "plan": ["autoPercentUsed": 10, "apiPercentUsed": 0],
                "onDemand": ["enabled": false, "used": 0, "limit": 40000],
            ],
        ]))
        XCTAssertEqual(result.pool(.cursorOther)?.quotaUsed, 0)
        XCTAssertEqual(result.pools.map(\.poolHint), [.cursorModels, .cursorOther])
    }

    func testNormalizeTokenDecodesPercentColon() {
        XCTAssertEqual(
            CursorMapper.normalizeSessionToken("user_01ABC::session-value"),
            "user_01ABC::session-value"
        )
        XCTAssertEqual(
            CursorMapper.normalizeSessionToken("user_01ABC%3A%3Asession-value"),
            "user_01ABC::session-value"
        )
        XCTAssertEqual(
            CursorMapper.normalizeSessionToken("user_01ABC%3a%3asession-value"),
            "user_01ABC::session-value"
        )
        XCTAssertEqual(
            CursorMapper.cookieHeader("user_01ABC::jwt"),
            "WorkosCursorSessionToken=user_01ABC::jwt"
        )
    }

    func testChatGrokSKUIsNotBot() {
        XCTAssertFalse(CursorMapper.isGrokBotSKU("cursor-grok-4.6-high-fast"))
        XCTAssertFalse(CursorMapper.isGrokBotSKU("SuperGrok Heavy"))
        XCTAssertTrue(CursorMapper.isGrokBotSKU("grok-bot"))
    }

    func testOnDemandCentsAreNotOther() {
        let result = CursorMapper.mapUsageSummary(json([
            "individualUsage": [
                "plan": ["autoPercentUsed": 10, "apiPercentUsed": 12],
                "onDemand": ["enabled": true, "used": 20000, "limit": 40000],
            ],
        ]))
        XCTAssertEqual(result.pool(.cursorOther)?.quotaUsed, 12)
        XCTAssertNotEqual(result.pool(.cursorOther)?.quotaUsed, 200)
        XCTAssertNotEqual(result.pool(.cursorOther)?.quotaTotal, 400)
    }

    private func json(_ raw: Any) -> JSONValue {
        JSONValue.wrap(raw)
    }

    private func stringify(_ value: JSONValue) -> String {
        func unwrap(_ value: JSONValue) -> Any {
            switch value {
            case let .object(object): return object.mapValues(unwrap)
            case let .array(array): return array.map(unwrap)
            case let .string(text): return text
            case let .number(number): return number
            case let .bool(flag): return flag
            case .null: return NSNull()
            }
        }
        let data = try! JSONSerialization.data(withJSONObject: unwrap(value), options: [])
        return String(data: data, encoding: .utf8)!
    }
}
