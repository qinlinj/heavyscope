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

    public init(
        language: AppLanguage = .simplifiedChinese,
        refreshInterval: TimeInterval = LiveConstants.defaultRefreshInterval,
        selectedPool: QuotaSelectionStorage = .tightest,
        lastCursorSync: Date? = nil,
        lastGrokSync: Date? = nil,
        lastCursorError: String? = nil,
        lastGrokError: String? = nil
    ) {
        self.language = language
        self.refreshInterval = refreshInterval
        self.selectedPool = selectedPool
        self.lastCursorSync = lastCursorSync
        self.lastGrokSync = lastGrokSync
        self.lastCursorError = lastCursorError
        self.lastGrokError = lastGrokError
    }

    public var selection: QuotaSelection {
        selectedPool.selection
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
