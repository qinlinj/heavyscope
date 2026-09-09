import Foundation

public enum PoolHint: String, CaseIterable, Codable, Sendable {
    case grokHeavy = "grok_heavy"
    case grokBot = "grok_bot"
    case cursorModels = "cursor_models"
    case cursorOther = "cursor_other"

    /// Web sql.js preset id. Same four pools as 0.27; Swift does not change adapters.
    public var presetId: String {
        switch self {
        case .grokHeavy: return "preset-grok-heavy"
        case .grokBot: return "preset-grok-bot"
        case .cursorModels: return "preset-cursor-models"
        case .cursorOther: return "preset-cursor-other"
        }
    }

    public var displayNameEN: String {
        switch self {
        case .grokHeavy: return "Grok Heavy"
        case .grokBot: return "Grok Bot"
        case .cursorModels: return "Cursor Models"
        case .cursorOther: return "Cursor Other Models"
        }
    }

    public var displayNameZH: String {
        switch self {
        case .grokHeavy: return "Grok Heavy"
        case .grokBot: return "Grok Bot"
        case .cursorModels: return "Cursor Models"
        case .cursorOther: return "Cursor Other Models"
        }
    }

    public var resetCycle: ResetCycle {
        switch self {
        case .grokHeavy, .grokBot: return .weekly
        case .cursorModels, .cursorOther: return .monthly
        }
    }

    /// Preset accent from the web product. Not copied from CodexMeter.
    public var accentHex: String {
        switch self {
        case .grokHeavy: return "#38BDF8"
        case .grokBot: return "#A78BFA"
        case .cursorModels: return "#34D399"
        case .cursorOther: return "#FBBF24"
        }
    }
}

public enum ResetCycle: String, Codable, Sendable {
    case weekly
    case monthly

    public var defaultDuration: TimeInterval {
        switch self {
        case .weekly: return 7 * 24 * 60 * 60
        case .monthly: return 30 * 24 * 60 * 60
        }
    }
}

public enum LiveErrorCode: String, Codable, Sendable, Equatable {
    case ok
    case expired
    case invalid
    case http
    case cors
    case network
    case unavailable
}

public enum ConsumptionPace: Equatable, Sendable {
    case onTrack
    case overPace
    case unavailable
}

public enum QuotaAttentionLevel: Equatable, Sendable {
    case normal
    case warning
    case critical
}

public struct LivePoolUpdate: Equatable, Sendable, Identifiable {
    public var poolHint: PoolHint
    public var quotaUsed: Double
    public var quotaTotal: Double?
    public var resetAt: Date?
    public var resetCycle: ResetCycle
    public var unit: String
    public var note: String?
    public var recordedAt: Date
    public var windowStart: Date?

    public var id: String { poolHint.rawValue }

    public init(
        poolHint: PoolHint,
        quotaUsed: Double,
        quotaTotal: Double? = LiveConstants.percentTotal,
        resetAt: Date? = nil,
        resetCycle: ResetCycle? = nil,
        unit: String = LiveConstants.percentUnit,
        note: String? = nil,
        recordedAt: Date = Date(),
        windowStart: Date? = nil
    ) {
        self.poolHint = poolHint
        self.quotaUsed = quotaUsed
        self.quotaTotal = quotaTotal
        self.resetAt = resetAt
        self.resetCycle = resetCycle ?? poolHint.resetCycle
        self.unit = unit
        self.note = note
        self.recordedAt = recordedAt
        self.windowStart = windowStart
    }

    public var remainingPercent: Double {
        guard let total = quotaTotal, total > 0 else {
            return Self.clamp(100 - quotaUsed)
        }
        return Self.clamp(100 - (quotaUsed / total) * 100)
    }

    public var usedPercent: Double {
        guard let total = quotaTotal, total > 0 else {
            return quotaUsed
        }
        return (quotaUsed / total) * 100
    }

    public func remainingTimePercent(at date: Date = Date()) -> Double? {
        guard let resetsAt = resetAt else { return nil }
        let remaining = resetsAt.timeIntervalSince(date)
        guard remaining >= 0 else { return nil }
        let duration = windowDuration(at: date)
        guard duration > 0 else { return nil }
        return min(100, max(0, remaining / duration * 100))
    }

    public func pace(at date: Date = Date()) -> ConsumptionPace {
        guard let remainingTime = remainingTimePercent(at: date) else {
            return .unavailable
        }
        return remainingPercent >= remainingTime ? .onTrack : .overPace
    }

    public func attentionLevel(at date: Date = Date(), criticalBelow threshold: Double = 20) -> QuotaAttentionLevel {
        if remainingPercent < threshold { return .critical }
        return pace(at: date) == .overPace ? .warning : .normal
    }

    public func windowDuration(at date: Date = Date()) -> TimeInterval {
        if let start = windowStart, let end = resetAt, end > start {
            return end.timeIntervalSince(start)
        }
        if let end = resetAt {
            let inferredStart = end.addingTimeInterval(-resetCycle.defaultDuration)
            if date >= inferredStart {
                return end.timeIntervalSince(inferredStart)
            }
        }
        return resetCycle.defaultDuration
    }

    public static func clamp(_ value: Double) -> Double {
        min(100, max(0, value))
    }
}

public struct LiveProviderResult: Equatable, Sendable {
    public var ok: Bool
    public var code: LiveErrorCode
    public var message: String
    public var pools: [LivePoolUpdate]
    public var resetAt: Date?
    public var botUnavailable: Bool

    public init(
        ok: Bool,
        code: LiveErrorCode,
        message: String,
        pools: [LivePoolUpdate],
        resetAt: Date? = nil,
        botUnavailable: Bool = false
    ) {
        self.ok = ok
        self.code = code
        self.message = message
        self.pools = pools
        self.resetAt = resetAt
        self.botUnavailable = botUnavailable
    }

    public func pool(_ hint: PoolHint) -> LivePoolUpdate? {
        pools.first { $0.poolHint == hint }
    }

    public static func failure(
        _ code: LiveErrorCode,
        _ message: String,
        botUnavailable: Bool = false
    ) -> LiveProviderResult {
        LiveProviderResult(
            ok: false,
            code: code,
            message: message,
            pools: [],
            botUnavailable: botUnavailable
        )
    }
}

public enum CursorJSONParse: Equatable, Sendable {
    case value(JSONValue)
    case error(LiveProviderResult)

    public var json: JSONValue? {
        if case let .value(value) = self { return value }
        return nil
    }

    public var error: LiveProviderResult? {
        if case let .error(value) = self { return value }
        return nil
    }
}

public enum LiveConstants {
    public static let percentTotal: Double = 100
    public static let percentUnit = "%"
    public static let includedCapCopyCents = 40_000
    public static let includedCapCopyUSD = 400
    public static let otherSourceNote = "Included in Ultra / Other Models"
    public static let browserUserAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    public static let cursorOrigin = "https://cursor.com"
    public static let cursorSpendingReferer = "https://cursor.com/dashboard/spending"
    public static let cursorUsagePath = "/api/usage-summary"
    public static let cursorPeriodPath = "/api/dashboard/get-current-period-usage"
    public static let cursorAggregatedPath = "/api/dashboard/get-aggregated-usage-events"
    public static let cursorFilteredPath = "/api/dashboard/get-filtered-usage-events"
    public static let cursorSandPath = "/api/dashboard/get-sand-usage-status"
    public static let grokOrigin = "https://grok.com"
    public static let grokCreditsPath = "/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig"
    public static let grokCliOrigin = "https://cli-chat-proxy.grok.com"
    public static let grokCliBillingPath = "/v1/billing?format=credits"
    public static let grokCliTokenAuth = "xai-grok-cli"
    public static let snapshotAnchorInterval: TimeInterval = 15 * 60
    public static let defaultRefreshInterval: TimeInterval = 60
}

public enum QuotaSelection: Equatable, Sendable {
    case tightest
    case pool(PoolHint)
}

public enum MenuBarIndicator {
    /// Outer ring = remaining of the selected or tightest connected pool.
    /// Inner ring = time remaining when reset timing is known.
    public static func rings(
        pools: [LivePoolUpdate],
        selection: QuotaSelection,
        at date: Date = Date()
    ) -> (outerRemaining: Double?, innerTimeRemaining: Double?, label: PoolHint?) {
        let connected = pools.filter { $0.quotaTotal != nil }
        let chosen: LivePoolUpdate?
        switch selection {
        case .tightest:
            chosen = connected.max { lhs, rhs in
                if lhs.usedPercent == rhs.usedPercent {
                    return lhs.remainingPercent > rhs.remainingPercent
                }
                return lhs.usedPercent < rhs.usedPercent
            }
        case let .pool(hint):
            chosen = connected.first { $0.poolHint == hint } ?? connected.first { $0.poolHint == hint }
        }
        guard let pool = chosen else {
            return (nil, nil, nil)
        }
        return (pool.remainingPercent, pool.remainingTimePercent(at: date), pool.poolHint)
    }
}
