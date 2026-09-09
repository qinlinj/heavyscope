import Foundation

/// Grok Heavy from GetGrokCreditsConfig / CLI billing JSON.
/// Grok Bot on the native product is Cursor SAND `usagePercent` — grok.com GROK_CHAT is not Bot.
public enum GrokMapper {
    public static let needsBearer =
        "Grok session expired or needs a Bearer token (gRPC 16 / unauthenticated). Cookie-only GetGrokCreditsConfig can fail; auto-refresh stays on."

    public static func normalizeBearer(_ raw: String) -> String {
        var value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.lowercased().hasPrefix("bearer ") {
            value = String(value.dropFirst(7)).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return value
    }

    public static func cookieHeader(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"^Cookie:\s*"#, with: "", options: [.regularExpression, .caseInsensitive])
    }

    public static func grpcWebEmptyBody() -> Data {
        Data([0, 0, 0, 0, 0])
    }

    public static func mapCreditsResponse(status: Int, body: Data, headers: [String: String] = [:]) -> LiveProviderResult {
        if status == 401 || status == 403 {
            return .failure(.expired, "\(needsBearer) HTTP \(status)")
        }
        if status < 200 || status >= 300 {
            return .failure(.http, "Grok credits request failed with HTTP \(status)")
        }
        return parseCreditsPayload(body, headers: headers)
    }

    public static func mapCLIBillingResponse(status: Int, bodyText: String) -> LiveProviderResult {
        if status == 401 || status == 403 {
            return .failure(.expired, "\(needsBearer) CLI billing HTTP \(status)")
        }
        if status < 200 || status >= 300 {
            return .failure(.http, "Grok CLI billing failed with HTTP \(status)")
        }
        do {
            return mapCLIBillingJSON(try JSONValue.parse(bodyText))
        } catch {
            return .failure(.invalid, "Grok CLI billing response was not JSON")
        }
    }

    /// Heavy from creditUsagePercent. Bot product rows are diagnostics only on this native slice
    /// (product Bot is Cursor SAND). Never invent Heavy when the field is missing — 0 is the wire default.
    public static func mapCLIBillingJSON(_ raw: JSONValue, recordedAt: Date = Date()) -> LiveProviderResult {
        guard let root = raw.object else {
            return .failure(.invalid, "Grok CLI billing JSON was not an object")
        }
        let config = root["config"]?.object ?? root
        let creditUsagePercent = JSONValue.object(config).finiteNumber("creditUsagePercent")
            ?? JSONValue.object(config).finiteNumber("credit_usage_percent")
            ?? 0
        let currentPeriod = config["currentPeriod"]?.object ?? config["current_period"]?.object
        let periodEnd = currentPeriod?["end"]?.string
            ?? config["billingPeriodEnd"]?.string
            ?? config["billing_period_end"]?.string
        return LiveProviderResult(
            ok: true,
            code: .ok,
            message: "Grok Heavy mapped via CLI billing",
            pools: [
                LivePoolUpdate(
                    poolHint: .grokHeavy,
                    quotaUsed: creditUsagePercent,
                    quotaTotal: LiveConstants.percentTotal,
                    resetAt: ISODates.parse(periodEnd),
                    resetCycle: .weekly,
                    unit: LiveConstants.percentUnit,
                    note: "Grok CLI billing sync",
                    recordedAt: recordedAt
                ),
            ],
            resetAt: ISODates.parse(periodEnd),
            botUnavailable: true
        )
    }

    public static func parseCreditsPayload(_ body: Data, headers: [String: String] = [:], recordedAt: Date = Date()) -> LiveProviderResult {
        let decoded = decodeGRPCWeb(body, headers: headers)
        if isUnauthenticated(decoded.grpcStatus, message: decoded.grpcMessage) {
            return .failure(.expired, needsBearer)
        }
        guard let message = decoded.message, !message.isEmpty else {
            return .failure(.invalid, "Grok credits response had no protobuf message")
        }
        let config = firstMessage(message, field: 1) ?? (iterFields(message) != nil ? message : nil)
        guard let config, let fields = iterFields(config) else {
            return .failure(.invalid, "Grok credits protobuf could not be walked")
        }

        var creditUsagePercent: Double = 0
        var periodEnd: Date?
        var periodStart: Date?

        for field in fields {
            if field.number == 1, field.wire == 5, let value = parseFloat32(field.bytes) {
                creditUsagePercent = value
            } else if field.number == 4, field.wire == 2, let stamp = parseTimestamp(field.bytes) {
                periodStart = stamp
            } else if field.number == 5, field.wire == 2, let stamp = parseTimestamp(field.bytes) {
                periodEnd = stamp
            } else if field.number == 8, field.wire == 2 {
                let period = parseUsagePeriod(field.bytes)
                if periodStart == nil { periodStart = period.start }
                if periodEnd == nil { periodEnd = period.end }
            }
        }

        return LiveProviderResult(
            ok: true,
            code: .ok,
            message: "Grok Heavy mapped",
            pools: [
                LivePoolUpdate(
                    poolHint: .grokHeavy,
                    quotaUsed: creditUsagePercent,
                    quotaTotal: LiveConstants.percentTotal,
                    resetAt: periodEnd,
                    resetCycle: .weekly,
                    unit: LiveConstants.percentUnit,
                    note: "Grok live sync",
                    recordedAt: recordedAt,
                    windowStart: periodStart
                ),
            ],
            resetAt: periodEnd,
            botUnavailable: true
        )
    }

    public static func mergeLiveResults(_ proto: LiveProviderResult, _ json: LiveProviderResult) -> LiveProviderResult {
        if proto.ok, json.ok {
            let heavy = proto.pool(.grokHeavy) ?? json.pool(.grokHeavy)
            return LiveProviderResult(
                ok: heavy != nil,
                code: heavy != nil ? .ok : .invalid,
                message: "Grok Heavy mapped",
                pools: [heavy].compactMap { $0 },
                resetAt: heavy?.resetAt ?? proto.resetAt ?? json.resetAt,
                botUnavailable: true
            )
        }
        if proto.ok { return proto }
        if json.ok { return json }
        return proto.code == .expired ? proto : json
    }

    // MARK: - protobuf walker

    struct ProtoField {
        var number: Int
        var wire: Int
        var varint: UInt64?
        var bytes: Data
    }

    private static func decodeGRPCWeb(_ body: Data, headers: [String: String]) -> (message: Data?, grpcStatus: Int?, grpcMessage: String) {
        var grpcStatus = headers["grpc-status"].flatMap { Int($0) }
        var grpcMessage = headers["grpc-message"] ?? headers["Grpc-Message"] ?? ""
        var message: Data?
        var offset = 0
        while offset + 5 <= body.count {
            let compressed = body[offset]
            let length = body[offset + 1...offset + 4].reduce(0) { ($0 << 8) | UInt32($1) }
            offset += 5
            guard offset + Int(length) <= body.count else { break }
            let chunk = body.subdata(in: offset..<(offset + Int(length)))
            offset += Int(length)
            if compressed == 0 {
                if message == nil {
                    message = chunk
                } else if let trailer = String(data: chunk, encoding: .utf8) {
                    if let status = trailer.firstMatch("grpc-status: ?(\\d+)") {
                        grpcStatus = Int(status)
                    }
                    if let text = trailer.firstMatch("grpc-message: ?(.+)") {
                        grpcMessage = text
                    }
                }
            }
        }
        return (message, grpcStatus, grpcMessage)
    }

    private static func isUnauthenticated(_ status: Int?, message: String) -> Bool {
        if status == 16 { return true }
        return message.range(
            of: #"unauthenticated|wke\s*=\s*unauthenticated|no-credentials"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }

    private static func iterFields(_ data: Data) -> [ProtoField]? {
        var fields: [ProtoField] = []
        var pos = 0
        let bytes = [UInt8](data)
        while pos < bytes.count {
            guard let key = readVarint(bytes, pos: pos) else { return nil }
            let number = Int(key.value >> 3)
            let wire = Int(key.value & 0x07)
            pos = key.pos
            switch wire {
            case 0:
                guard let varint = readVarint(bytes, pos: pos) else { return nil }
                fields.append(ProtoField(number: number, wire: wire, varint: varint.value, bytes: Data()))
                pos = varint.pos
            case 1:
                guard pos + 8 <= bytes.count else { return nil }
                fields.append(ProtoField(number: number, wire: wire, bytes: Data(bytes[pos..<(pos + 8)])))
                pos += 8
            case 2:
                guard let length = readVarint(bytes, pos: pos) else { return nil }
                pos = length.pos
                guard pos + Int(length.value) <= bytes.count else { return nil }
                fields.append(ProtoField(number: number, wire: wire, bytes: Data(bytes[pos..<(pos + Int(length.value))])))
                pos += Int(length.value)
            case 5:
                guard pos + 4 <= bytes.count else { return nil }
                fields.append(ProtoField(number: number, wire: wire, bytes: Data(bytes[pos..<(pos + 4)])))
                pos += 4
            default:
                return nil
            }
        }
        return fields
    }

    private static func firstMessage(_ data: Data, field: Int) -> Data? {
        guard let fields = iterFields(data) else { return nil }
        return fields.first { $0.number == field && $0.wire == 2 }?.bytes
    }

    private static func parseFloat32(_ data: Data) -> Double? {
        guard data.count >= 4 else { return nil }
        var value: Float32 = 0
        _ = withUnsafeMutableBytes(of: &value) { dest in
            data.prefix(4).copyBytes(to: dest)
        }
        return value.isFinite ? Double(value) : nil
    }

    private static func parseTimestamp(_ message: Data) -> Date? {
        guard let fields = iterFields(message) else { return nil }
        var seconds: UInt64 = 0
        var nanos: UInt64 = 0
        for field in fields {
            if field.number == 1, field.wire == 0, let value = field.varint { seconds = value }
            if field.number == 2, field.wire == 0, let value = field.varint { nanos = value }
        }
        guard seconds > 0 else { return nil }
        return Date(timeIntervalSince1970: Double(seconds) + Double(nanos) / 1_000_000_000)
    }

    private static func parseUsagePeriod(_ message: Data) -> (start: Date?, end: Date?) {
        guard let fields = iterFields(message) else { return (nil, nil) }
        var start: Date?
        var end: Date?
        for field in fields where field.wire == 2 {
            if field.number == 1 { start = parseTimestamp(field.bytes) }
            if field.number == 2 { end = parseTimestamp(field.bytes) }
        }
        return (start, end)
    }

    private static func readVarint(_ bytes: [UInt8], pos: Int) -> (value: UInt64, pos: Int)? {
        var value: UInt64 = 0
        var shift: UInt64 = 0
        var cursor = pos
        while cursor < bytes.count {
            let byte = bytes[cursor]
            cursor += 1
            value |= UInt64(byte & 0x7F) << shift
            if byte & 0x80 == 0 { return (value, cursor) }
            shift += 7
            if shift > 63 { return nil }
        }
        return nil
    }
}

private extension String {
    func firstMatch(_ pattern: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return nil
        }
        let range = NSRange(startIndex..., in: self)
        guard let match = regex.firstMatch(in: self, options: [], range: range),
              match.numberOfRanges > 1,
              let capture = Range(match.range(at: 1), in: self)
        else {
            return nil
        }
        return String(self[capture]).trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
