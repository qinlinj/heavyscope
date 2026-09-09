import Combine
import Foundation

@MainActor
final class UsageService: ObservableObject {
    @Published private(set) var pools: [LivePoolUpdate] = []
    @Published private(set) var preferences: AppPreferences
    @Published private(set) var stale = false
    @Published private(set) var isRefreshing = false
    @Published private(set) var lastUpdated: Date?
    @Published var showSettings = false
    @Published var showHistory = false

    let store: SnapshotStore
    let secrets: SecretStore
    private let preferencesStore: PreferencesStore
    private let client: LiveClient
    private var timer: Timer?
    private var didStart = false

    init(
        store: SnapshotStore,
        secrets: SecretStore,
        preferencesStore: PreferencesStore,
        client: LiveClient
    ) {
        self.store = store
        self.secrets = secrets
        self.preferencesStore = preferencesStore
        self.client = client
        self.preferences = preferencesStore.load()
        pools = (try? store.latestPools()) ?? []
        lastUpdated = pools.map(\.recordedAt).max()
    }

    convenience init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("HeavyScope", isDirectory: true)
        let db = support.appendingPathComponent("UsageHistory.sqlite")
        let store = try! SnapshotStore(path: db)
        #if os(macOS)
        let secrets: SecretStore = KeychainSecretStore()
        #else
        let secrets: SecretStore = MemorySecretStore()
        #endif
        self.init(
            store: store,
            secrets: secrets,
            preferencesStore: UserDefaultsPreferencesStore(),
            client: LiveClient(transport: URLSessionLiveTransport())
        )
    }

    var language: AppLanguage { preferences.language }

    var hasAnyCredential: Bool {
        !(secrets.get(.cursorSession) ?? "").isEmpty
            || !(secrets.get(.grokCookie) ?? "").isEmpty
            || !(secrets.get(.grokBearer) ?? "").isEmpty
    }

    func t(_ key: String) -> String {
        L10n.text(key, language: language)
    }

    func start() {
        if didStart {
            Task { await refresh() }
            return
        }
        didStart = true
        restartTimer()
        Task { await refresh() }
    }

    func updatePreferences(_ next: AppPreferences) {
        preferences = next
        preferencesStore.save(next)
        restartTimer()
    }

    func saveSecrets(cursor: String, grokCookie: String, grokBearer: String) {
        try? secrets.set(.cursorSession, value: CursorMapper.normalizeSessionToken(cursor))
        try? secrets.set(.grokCookie, value: GrokMapper.cookieHeader(grokCookie))
        try? secrets.set(.grokBearer, value: GrokMapper.normalizeBearer(grokBearer))
    }

    func refresh() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        let result = await client.refreshAll(
            cursorToken: secrets.get(.cursorSession),
            grokCookie: secrets.get(.grokCookie),
            grokBearer: secrets.get(.grokBearer),
            lastGood: pools
        )
        pools = result.pools
        stale = result.stale
        lastUpdated = Date()
        var prefs = preferences
        if let cursor = result.cursor {
            prefs.lastCursorSync = cursor.ok ? Date() : prefs.lastCursorSync
            prefs.lastCursorError = cursor.ok ? nil : cursor.message
        }
        if let grok = result.grok {
            prefs.lastGrokSync = grok.ok ? Date() : prefs.lastGrokSync
            prefs.lastGrokError = grok.ok ? nil : grok.message
        }
        updatePreferences(prefs)
        for pool in result.pools {
            _ = try? store.record(pool)
        }
    }

    func pool(_ hint: PoolHint) -> LivePoolUpdate? {
        pools.first { $0.poolHint == hint }
    }

    func rings() -> (outerRemaining: Double?, innerTimeRemaining: Double?, usedPercent: Double?, label: PoolHint?) {
        MenuBarIndicator.rings(pools: pools, connectedHints: connectedHints)
    }

    /// A pool is connected only after a successful last-good snapshot exists.
    var connectedHints: Set<PoolHint> {
        Set(pools.map(\.poolHint))
    }

    var tightest: LivePoolUpdate? {
        MenuBarIndicator.tightestConnected(in: pools, connectedHints: connectedHints)
    }

    private func restartTimer() {
        timer?.invalidate()
        let interval = max(30, preferences.refreshInterval)
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.refresh()
            }
        }
    }
}
