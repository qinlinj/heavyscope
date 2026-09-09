import Foundation

public enum AppLanguage: String, CaseIterable, Codable, Sendable {
    case english = "en"
    case simplifiedChinese = "zh-Hans"

    public var localeIdentifier: String { rawValue }
}

public struct AppPreferences: Equatable, Sendable, Codable {
    public var language: AppLanguage
    public var refreshInterval: TimeInterval
    public var selectedPool: QuotaSelectionStorage
    public var lastCursorSync: Date?
    public var lastGrokSync: Date?
    public var lastCursorError: String?
    public var lastGrokError: String?
    public var showQuotaHistory: Bool
    public var showTokenActivity: Bool

    public init(
        language: AppLanguage = .simplifiedChinese,
        refreshInterval: TimeInterval = LiveConstants.defaultRefreshInterval,
        selectedPool: QuotaSelectionStorage = .tightest,
        lastCursorSync: Date? = nil,
        lastGrokSync: Date? = nil,
        lastCursorError: String? = nil,
        lastGrokError: String? = nil,
        showQuotaHistory: Bool = true,
        showTokenActivity: Bool = true
    ) {
        self.language = language
        self.refreshInterval = refreshInterval
        self.selectedPool = selectedPool
        self.lastCursorSync = lastCursorSync
        self.lastGrokSync = lastGrokSync
        self.lastCursorError = lastCursorError
        self.lastGrokError = lastGrokError
        self.showQuotaHistory = showQuotaHistory
        self.showTokenActivity = showTokenActivity
    }

    public var selection: QuotaSelection {
        selectedPool.selection
    }

    enum CodingKeys: String, CodingKey {
        case language, refreshInterval, selectedPool
        case lastCursorSync, lastGrokSync, lastCursorError, lastGrokError
        case showQuotaHistory, showTokenActivity
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        language = try container.decodeIfPresent(AppLanguage.self, forKey: .language) ?? .simplifiedChinese
        refreshInterval = try container.decodeIfPresent(TimeInterval.self, forKey: .refreshInterval) ?? LiveConstants.defaultRefreshInterval
        selectedPool = try container.decodeIfPresent(QuotaSelectionStorage.self, forKey: .selectedPool) ?? .tightest
        lastCursorSync = try container.decodeIfPresent(Date.self, forKey: .lastCursorSync)
        lastGrokSync = try container.decodeIfPresent(Date.self, forKey: .lastGrokSync)
        lastCursorError = try container.decodeIfPresent(String.self, forKey: .lastCursorError)
        lastGrokError = try container.decodeIfPresent(String.self, forKey: .lastGrokError)
        showQuotaHistory = try container.decodeIfPresent(Bool.self, forKey: .showQuotaHistory) ?? true
        showTokenActivity = try container.decodeIfPresent(Bool.self, forKey: .showTokenActivity) ?? true
    }
}

public enum QuotaSelectionStorage: Equatable, Hashable, Sendable, Codable {
    case tightest
    case pool(PoolHint)

    public var selection: QuotaSelection {
        switch self {
        case .tightest: return .tightest
        case let .pool(hint): return .pool(hint)
        }
    }
}

public protocol PreferencesStore: AnyObject {
    func load() -> AppPreferences
    func save(_ preferences: AppPreferences)
}

public final class MemoryPreferencesStore: PreferencesStore, @unchecked Sendable {
    private var value: AppPreferences

    public init(_ value: AppPreferences = AppPreferences()) {
        self.value = value
    }

    public func load() -> AppPreferences { value }

    public func save(_ preferences: AppPreferences) { value = preferences }
}

public final class UserDefaultsPreferencesStore: PreferencesStore, @unchecked Sendable {
    private let defaults: UserDefaults
    private let key: String

    public init(defaults: UserDefaults = .standard, key: String = "heavyscope.preferences") {
        self.defaults = defaults
        self.key = key
    }

    public func load() -> AppPreferences {
        guard let data = defaults.data(forKey: key),
              let decoded = try? JSONDecoder().decode(AppPreferences.self, from: data)
        else {
            return AppPreferences()
        }
        return decoded
    }

    public func save(_ preferences: AppPreferences) {
        if let data = try? JSONEncoder().encode(preferences) {
            defaults.set(data, forKey: key)
        }
    }
}
