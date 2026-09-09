import Foundation

/// Honest Cursor Spending / SAND / usage-summary mapping (0.23–0.27).
/// Models = `autoPercentUsed`; Other = `apiPercentUsed` only; Bot = SAND `usagePercent`.
/// See `NativeMacMapping` and sibling `docs/NATIVE_MAC_MAPPING.md`.
public enum CursorMapper {
    public static func sandUsageRequestBody() -> String { "{}" }

    public static func aggregatedUsageRequestBody(startMs: Int64, endMs: Int64) -> String {
        #"{"teamId":-1,"startDate":\#(startMs),"endDate":\#(endMs)}"#
    }

    public static func filteredUsageRequestBody(startMs: Int64, endMs: Int64) -> String {
        #"{"teamId":-1,"startDate":\#(startMs),"endDate":\#(endMs),"page":1,"pageSize":100}"#
    }

    public static func normalizeSessionToken(_ raw: String) -> String {
        var value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if (value.hasPrefix("\"") && value.hasSuffix("\"")) || (value.hasPrefix("'") && value.hasSuffix("'")) {
            value.removeFirst()
            value.removeLast()
        }
        if value.lowercased().hasPrefix("workoscursorsessiontoken=") {
            value = String(value.dropFirst("WorkosCursorSessionToken=".count))
        }
        guard !value.isEmpty else { return "" }
        value = decodeSeparator(value)
        if value.contains("::") { return value }
        if let sub = decodeJWTSub(value) {
            return "\(sub)::\(value)"
        }
        return value
    }

    public static func deriveSessionTokenFromJWT(_ jwt: String) -> String? {
        let trimmed = decodeSeparator(jwt.trimmingCharacters(in: .whitespacesAndNewlines))
        guard !trimmed.isEmpty else { return nil }
        if trimmed.contains("::") { return trimmed }
        guard let sub = decodeJWTSub(trimmed) else { return nil }
        return "\(sub)::\(trimmed)"
    }

    public static func cookieHeader(_ token: String) -> String {
        let value = normalizeSessionToken(token)
        guard !value.isEmpty else { return "" }
        if value.lowercased().hasPrefix("workoscursorsessiontoken=") { return value }
        return "WorkosCursorSessionToken=\(value)"
    }

    /// True only for a real Grok Bot / Grok API / Agents SKU row.
    /// Cursor Grok chat models, Composer, and Heavy stay out of grok_bot.
    public static func isGrokBotSKU(_ raw: String) -> Bool {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !text.isEmpty else { return false }
        let compact = text.replacingOccurrences(of: #"[\s_]+"#, with: "-", options: .regularExpression)

        if compact.contains("composer") || text.contains("composer") { return false }
        if compact.contains("cursor-grok") || text.contains("cursor grok") { return false }

        let heavy = compact.range(of: #"(?:super-)?grok-heavy|\bheavy\b"#, options: .regularExpression) != nil
            || text.range(of: #"\bheavy\b"#, options: .regularExpression) != nil
        let grokBotLiteral = compact.contains("grok-bot") || text.contains("grok bot")
        if heavy && !grokBotLiteral { return false }

        let hasBotAPIAgents = compact.range(of: #"(?:^|[^a-z])(bot|api|agents?)(?:[^a-z]|$)"#, options: .regularExpression) != nil
            || text.range(of: #"\b(bot|api|agents?)\b"#, options: .regularExpression) != nil
        let isCursorChatGrok = compact.range(of: #"(?:^|[^a-z])grok-[234](?:$|[^a-z0-9])"#, options: .regularExpression) != nil
        if isCursorChatGrok && !hasBotAPIAgents { return false }

        if grokBotLiteral || compact == "grok-bot" { return true }
        if compact.contains("grok-api") || compact.contains("grok-agents") { return true }
        if text.contains("grok") && hasBotAPIAgents { return true }
        return false
    }

    public static func sandRemainingPercent(_ usagePercent: Double) -> Double {
        LivePoolUpdate.clamp(100 - usagePercent)
    }

    public static func isTeamIDRequiredBody(_ body: String?) -> Bool {
        guard let body, !body.isEmpty else { return false }
        if body.contains("Team ID is required") { return true }
        return body.contains("ERROR_UNAUTHORIZED")
            && body.range(of: #"team\s*id"#, options: [.regularExpression, .caseInsensitive]) != nil
    }

    /// True only for a real auth rejection. 405 and Team-ID 401/403 are not expired.
    public static func isSessionExpired(status: Int, body: String? = nil) -> Bool {
        if status == 405 { return false }
        if status != 401 && status != 403 { return false }
        if isTeamIDRequiredBody(body) { return false }
        return true
    }

    public static func mapHTTPStatus(status: Int, label: String, body: String? = nil) -> LiveProviderResult? {
        if status == 405 {
            return .failure(.http, "\(label) failed with HTTP 405 (Method not allowed)")
        }
        if status == 401 || status == 403 {
            if !isSessionExpired(status: status, body: body) {
                return .failure(.http, "\(label) failed with HTTP \(status)")
            }
            return .failure(
                .expired,
                "Cursor session expired or was rejected (HTTP \(status)). Paste a new WorkosCursorSessionToken."
            )
        }
        if status < 200 || status >= 300 {
            return .failure(.http, "\(label) failed with HTTP \(status)")
        }
        return nil
    }

    public static func parseJSONBody(status: Int, body: String, label: String) -> CursorJSONParse {
        if let statusError = mapHTTPStatus(status: status, label: label, body: body) {
            return .error(statusError)
        }
        let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return .error(.failure(.invalid, "\(label) response was empty"))
        }
        do {
            return .value(try JSONValue.parse(trimmed))
        } catch {
            return .error(.failure(.invalid, "\(label) was not valid JSON"))
        }
    }

    public static func mapUsageSummary(_ input: JSONValue, recordedAt: Date = Date()) -> LiveProviderResult {
        guard let root = unwrap(input) else {
            return .failure(.invalid, "Cursor usage-summary is not an object")
        }
        let individual = root["individualUsage"]?.object
        let plan = individual?["plan"]?.object.map { JSONValue.object($0) }
        let autoPercent = autoPercent(from: .object(root), plan: plan)
        let apiPercent = apiPercent(from: .object(root), plan: plan)
        if autoPercent == nil && apiPercent == nil {
            return .failure(.invalid, "Cursor usage-summary is missing autoPercentUsed and apiPercentUsed")
        }
        let resetAt = ISODates.parse(root["billingCycleEnd"])
        var pools: [LivePoolUpdate] = []
        if let autoPercent {
            pools.append(modelsPool(autoPercent, resetAt: resetAt, recordedAt: recordedAt))
        }
        if let apiPercent {
            pools.append(otherPercentPool(apiPercent, resetAt: resetAt, recordedAt: recordedAt))
        }
        guard !pools.isEmpty else {
            return .failure(.invalid, "Cursor usage-summary had no mappable pools")
        }
        return LiveProviderResult(
            ok: true,
            code: .ok,
            message: "Cursor usage-summary mapped",
            pools: pools,
            resetAt: resetAt,
            botUnavailable: true
        )
    }

    public static func mapPeriodUsage(
        _ input: JSONValue,
        recordedAt: Date = Date()
    ) -> (models: LivePoolUpdate?, other: LivePoolUpdate?, resetAt: Date?) {
        guard let root = unwrap(input) else {
            return (nil, nil, nil)
        }
        let plan = planUsageRecord(.object(root))
        let resetAt = ISODates.parse(root["billingCycleEnd"])
        let auto = autoPercent(from: .object(root), plan: plan)
        let api = apiPercent(from: .object(root), plan: plan)
        return (
            auto.map { modelsPool($0, resetAt: resetAt, recordedAt: recordedAt) },
            api.map { otherPercentPool($0, resetAt: resetAt, recordedAt: recordedAt) },
            resetAt
        )
    }

    /// Map get-sand-usage-status onto the Grok Bot weekly pool.
    /// usagePercent is used%; remaining% = clamp(100 - usagePercent, 0, 100).
    /// Never fake used/remaining/limit counts. Flags are not amounts.
    public static func mapSandUsage(_ input: JSONValue, recordedAt: Date = Date()) -> LivePoolUpdate? {
        guard let root = unwrap(input) else { return nil }
        guard let usagePercent = JSONValue.object(root).finiteNumber("usagePercent") else { return nil }
        let resetAt = ISODates.parse(root["nextResetTimestampUtc"]) ?? ISODates.parse(root["currentPeriodStart"])
        return grokBotPercentPool(usagePercent, resetAt: resetAt, recordedAt: recordedAt)
    }

    public static func mapGrokBotFromRows(
        _ input: JSONValue?,
        resetAt: Date?,
        recordedAt: Date = Date()
    ) -> LivePoolUpdate? {
        guard let root = input.flatMap(unwrap) else { return nil }
        let rows = JSONWalk.recordArray(root["aggregations"])
            + JSONWalk.recordArray(root["usageEventsDisplay"])
            + JSONWalk.recordArray(root["events"])
        guard let extracted = collectGrokBotRows(rows) else { return nil }
        return LivePoolUpdate(
            poolHint: .grokBot,
            quotaUsed: extracted.used,
            quotaTotal: extracted.total,
            resetAt: resetAt,
            resetCycle: .weekly,
            unit: extracted.unit,
            note: "Cursor aggregation grok-bot SKU",
            recordedAt: recordedAt
        )
    }

    public static func mergeSpendingSources(
        period: JSONValue? = nil,
        aggregations: JSONValue? = nil,
        events: JSONValue? = nil,
        summary: JSONValue? = nil,
        sand: JSONValue? = nil,
        recordedAt: Date = Date()
    ) -> LiveProviderResult {
        let window = resolveBillingWindow(period: period, summary: summary, now: recordedAt)
        let periodMapped = period.map { mapPeriodUsage($0, recordedAt: recordedAt) }
        let summaryMapped = summary.flatMap { value -> LiveProviderResult? in
            JSONWalk.isObject(value) ? mapUsageSummary(value, recordedAt: recordedAt) : nil
        }
        let resetAt = periodMapped?.resetAt ?? window.resetAt ?? summaryMapped?.resetAt
        let sandBot = sand.flatMap { mapSandUsage($0, recordedAt: recordedAt) }
        let grok = sandBot
            ?? mapGrokBotFromRows(aggregations, resetAt: resetAt, recordedAt: recordedAt)
            ?? mapGrokBotFromRows(events, resetAt: resetAt, recordedAt: recordedAt)
        let models = periodMapped?.models ?? summaryMapped?.pool(.cursorModels)
        let other = periodMapped?.other ?? summaryMapped?.pool(.cursorOther)

        var pools: [LivePoolUpdate] = []
        if var models {
            models.resetAt = models.resetAt ?? resetAt
            models.recordedAt = recordedAt
            pools.append(models)
        }
        if var other {
            other.resetAt = other.resetAt ?? resetAt
            other.recordedAt = recordedAt
            pools.append(other)
        }
        if var grok {
            grok.resetAt = grok.resetAt ?? resetAt
            grok.recordedAt = recordedAt
            pools.append(grok)
        }

        guard !pools.isEmpty else {
            return LiveProviderResult(
                ok: false,
                code: .invalid,
                message: "Cursor spending payloads had no mappable pools",
                pools: [],
                botUnavailable: true
            )
        }
        let labels = pools.map(\.poolHint.rawValue).joined(separator: ", ")
        return LiveProviderResult(
            ok: true,
            code: .ok,
            message: "Cursor spending mapped (\(labels))",
            pools: pools,
            resetAt: resetAt,
            botUnavailable: grok == nil
        )
    }

    /// When period / summary / aggregations already parsed, a 401/403/405 on
    /// events or SAND must not abort the merge.
    public static func finishLiveRefresh(
        period: JSONValue? = nil,
        summary: JSONValue? = nil,
        aggregations: JSONValue? = nil,
        eventsParsed: CursorJSONParse? = nil,
        sandParsed: CursorJSONParse? = nil,
        recordedAt: Date = Date()
    ) -> LiveProviderResult {
        let hasPrior = period != nil || summary != nil || aggregations != nil
        var events: JSONValue?
        if let eventsParsed {
            if let value = eventsParsed.json {
                events = value
            } else if !hasPrior, eventsParsed.error?.code == .expired, sandParsed == nil {
                return eventsParsed.error!
            }
        }
        var sand: JSONValue?
        if let sandParsed {
            if let value = sandParsed.json {
                sand = value
            } else if !hasPrior, events == nil {
                return sandParsed.error!
            }
        }
        return mergeSpendingSources(
            period: period,
            aggregations: aggregations,
            events: events,
            summary: summary,
            sand: sand,
            recordedAt: recordedAt
        )
    }

    public static func mapUsageResponse(status: Int, body: String) -> LiveProviderResult {
        switch parseJSONBody(status: status, body: body, label: "Cursor usage-summary") {
        case let .value(value):
            return mapUsageSummary(value)
        case let .error(error):
            return error
        }
    }

    public static func mapPeriodResponse(status: Int, body: String) -> LiveProviderResult {
        switch parseJSONBody(status: status, body: body, label: "Cursor current-period-usage") {
        case let .value(value):
            return mergeSpendingSources(period: value)
        case let .error(error):
            return error
        }
    }

    public static func mapAggregatedResponse(status: Int, body: String) -> LiveProviderResult {
        switch parseJSONBody(status: status, body: body, label: "Cursor aggregated-usage-events") {
        case let .value(value):
            return mergeSpendingSources(aggregations: value)
        case let .error(error):
            return error
        }
    }

    public static func mapSandResponse(status: Int, body: String) -> LiveProviderResult {
        switch parseJSONBody(status: status, body: body, label: "Cursor sand-usage-status") {
        case let .value(value):
            return mergeSpendingSources(sand: value)
        case let .error(error):
            return error
        }
    }

    public static func resolveBillingWindow(
        period: JSONValue?,
        summary: JSONValue?,
        now: Date = Date()
    ) -> (start: Date, end: Date, resetAt: Date?) {
        let periodRoot = period.flatMap(unwrap)
        let summaryRoot = summary.flatMap(unwrap)
        let start = ISODates.parse(periodRoot?["billingCycleStart"])
            ?? ISODates.parse(summaryRoot?["billingCycleStart"])
            ?? now.addingTimeInterval(-32 * 24 * 60 * 60)
        let end = ISODates.parse(periodRoot?["billingCycleEnd"])
            ?? ISODates.parse(summaryRoot?["billingCycleEnd"])
            ?? now
        let resetAt = ISODates.parse(periodRoot?["billingCycleEnd"])
            ?? ISODates.parse(summaryRoot?["billingCycleEnd"])
        return (min(start, end), max(start, end), resetAt)
    }

    // MARK: - Private mapping

    private static func unwrap(_ input: JSONValue) -> [String: JSONValue]? {
        guard let object = input.object else { return nil }
        if let nested = object["data"]?.object,
           object["planUsage"] == nil,
           object["aggregations"] == nil,
           object["usageEventsDisplay"] == nil,
           object["individualUsage"] == nil,
           object["autoPercentUsed"] == nil
        {
            return nested
        }
        return object
    }

    private static func planUsageRecord(_ root: JSONValue?) -> JSONValue? {
        guard let object = root?.object else { return nil }
        if let plan = object["planUsage"] { return plan }
        if let plan = object["individualUsage"]?["plan"] { return plan }
        if object["autoPercentUsed"]?.number != nil || object["totalSpend"]?.number != nil {
            return root
        }
        return nil
    }

    private static func autoPercent(from root: JSONValue?, plan: JSONValue?) -> Double? {
        if let value = plan?.finiteNumber("autoPercentUsed") { return value }
        if let value = root?.finiteNumber("autoPercentUsed") { return value }
        if let message = root?["autoModelSelectedDisplayMessage"]?.string {
            return parsePercent(from: message)
        }
        return nil
    }

    /// Spending #included-in-ultra Other Models meter.
    /// Other = apiPercentUsed. Never totalSpend or onDemand.used.
    private static func apiPercent(from root: JSONValue?, plan: JSONValue?) -> Double? {
        if let value = plan?.finiteNumber("apiPercentUsed") { return value }
        return root?.finiteNumber("apiPercentUsed")
    }

    private static func parsePercent(from message: String) -> Double? {
        guard let match = message.range(of: #"(\d+(?:\.\d+)?)\s*%"#, options: .regularExpression) else {
            return nil
        }
        let digits = message[match].trimmingCharacters(in: CharacterSet(charactersIn: "% ").union(.whitespaces))
        return Double(digits)
    }

    private static func modelsPool(_ percent: Double, resetAt: Date?, recordedAt: Date) -> LivePoolUpdate {
        LivePoolUpdate(
            poolHint: .cursorModels,
            quotaUsed: percent,
            quotaTotal: LiveConstants.percentTotal,
            resetAt: resetAt,
            resetCycle: .monthly,
            unit: LiveConstants.percentUnit,
            note: "Cursor live sync",
            recordedAt: recordedAt
        )
    }

    private static func otherPercentPool(_ percent: Double, resetAt: Date?, recordedAt: Date) -> LivePoolUpdate {
        LivePoolUpdate(
            poolHint: .cursorOther,
            quotaUsed: percent,
            quotaTotal: LiveConstants.percentTotal,
            resetAt: resetAt,
            resetCycle: .monthly,
            unit: LiveConstants.percentUnit,
            note: LiveConstants.otherSourceNote,
            recordedAt: recordedAt
        )
    }

    private static func grokBotPercentPool(_ usagePercent: Double, resetAt: Date?, recordedAt: Date) -> LivePoolUpdate {
        LivePoolUpdate(
            poolHint: .grokBot,
            quotaUsed: usagePercent,
            quotaTotal: LiveConstants.percentTotal,
            resetAt: resetAt,
            resetCycle: .weekly,
            unit: LiveConstants.percentUnit,
            note: "Cursor SAND weekly sync (Grok Bot)",
            recordedAt: recordedAt
        )
    }

    private struct BotExtract: Equatable {
        var used: Double
        var total: Double?
        var unit: String
    }

    private static func collectGrokBotRows(_ rows: [[String: JSONValue]]) -> BotExtract? {
        var best: BotExtract?
        for row in rows {
            let identity = rowIdentity(row)
            guard isGrokBotSKU(identity) else { continue }
            if let used = finite(row["used"]), let limit = finite(row["limit"]), limit > 0 {
                return BotExtract(used: used, total: limit, unit: LiveConstants.percentUnit)
            }
            if let cents = finite(row["totalCents"]) {
                let next = BotExtract(used: cents / 100, total: nil, unit: "USD")
                if best == nil { best = next }
            }
        }
        return best
    }

    private static func rowIdentity(_ row: [String: JSONValue]) -> String {
        let keys = ["modelIntent", "model", "product", "kind", "name", "sku", "displayName", "modelName"]
        return keys.compactMap { row[$0]?.string }.joined(separator: " ")
    }

    private static func finite(_ value: JSONValue?) -> Double? {
        value?.number.flatMap { $0.isFinite ? $0 : nil }
    }

    private static func decodeSeparator(_ value: String) -> String {
        value.replacingOccurrences(of: "%3A%3A", with: "::", options: .caseInsensitive)
    }

    private static func decodeJWTSub(_ jwt: String) -> String? {
        let parts = jwt.split(separator: ".", omittingEmptySubsequences: false).map(String.init)
        guard parts.count >= 2 else { return nil }
        var payload = parts[1]
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let pad = String(repeating: "=", count: (4 - payload.count % 4) % 4)
        payload += pad
        guard let data = Data(base64Encoded: payload),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              var sub = object["sub"] as? String
        else {
            return nil
        }
        sub = sub.trimmingCharacters(in: .whitespacesAndNewlines)
        if let last = sub.split(separator: "|").last {
            sub = String(last)
        }
        return sub.isEmpty ? nil : sub
    }
}
