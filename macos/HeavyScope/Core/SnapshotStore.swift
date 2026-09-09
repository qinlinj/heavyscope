import Foundation
#if canImport(SQLite3)
import SQLite3
#else
import CSQLite
#endif

public struct QuotaSnapshot: Equatable, Sendable, Identifiable {
    public var id: Int64
    public var poolHint: PoolHint
    public var usedPercent: Double
    public var remainingPercent: Double
    public var resetAt: Date?
    public var recordedAt: Date
    public var isAnchor: Bool

    public init(
        id: Int64 = 0,
        poolHint: PoolHint,
        usedPercent: Double,
        remainingPercent: Double,
        resetAt: Date? = nil,
        recordedAt: Date,
        isAnchor: Bool
    ) {
        self.id = id
        self.poolHint = poolHint
        self.usedPercent = usedPercent
        self.remainingPercent = remainingPercent
        self.resetAt = resetAt
        self.recordedAt = recordedAt
        self.isAnchor = isAnchor
    }
}

public struct DailyActivity: Equatable, Sendable, Identifiable {
    public var day: Date
    public var usedDelta: Double
    public var sampleCount: Int

    public var id: Date { day }
}

public struct HeatmapCell: Equatable, Sendable, Identifiable {
    public var day: Date
    public var intensity: Double
    public var sampleCount: Int

    public var id: Date { day }
}

/// Local SQLite snapshots: record a change, plus an unchanged 15-minute anchor.
public final class SnapshotStore: @unchecked Sendable {
    private var db: OpaquePointer?
    private let lock = NSLock()

    public init(path: URL) throws {
        try FileManager.default.createDirectory(at: path.deletingLastPathComponent(), withIntermediateDirectories: true)
        var handle: OpaquePointer?
        let status = sqlite3_open_v2(path.path, &handle, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil)
        guard status == SQLITE_OK, let handle else {
            throw StoreError.openFailed(String(cString: sqlite3_errmsg(handle)))
        }
        db = handle
        try exec(
            """
            CREATE TABLE IF NOT EXISTS snapshots (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              pool_hint TEXT NOT NULL,
              used_percent REAL NOT NULL,
              remaining_percent REAL NOT NULL,
              reset_at TEXT,
              recorded_at TEXT NOT NULL,
              is_anchor INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS snapshots_pool_time ON snapshots(pool_hint, recorded_at);
            """
        )
    }

    deinit {
        if let db { sqlite3_close(db) }
    }

    @discardableResult
    public func record(_ pool: LivePoolUpdate, now: Date = Date()) throws -> QuotaSnapshot? {
        lock.lock()
        defer { lock.unlock() }
        let last = try latestUnlocked(pool.poolHint)
        let usedChanged = last.map { abs($0.usedPercent - pool.usedPercent) > 0.0001 } ?? true
        let dueAnchor = last.map { now.timeIntervalSince($0.recordedAt) >= LiveConstants.snapshotAnchorInterval } ?? true
        guard usedChanged || dueAnchor else { return nil }
        let snapshot = QuotaSnapshot(
            poolHint: pool.poolHint,
            usedPercent: pool.usedPercent,
            remainingPercent: pool.remainingPercent,
            resetAt: pool.resetAt,
            recordedAt: now,
            isAnchor: !usedChanged
        )
        try insertUnlocked(snapshot)
        return try latestUnlocked(pool.poolHint)
    }

    public func latest(_ hint: PoolHint) throws -> QuotaSnapshot? {
        lock.lock()
        defer { lock.unlock() }
        return try latestUnlocked(hint)
    }

    public func latestPools() throws -> [LivePoolUpdate] {
        try PoolHint.allCases.compactMap { hint in
            guard let snap = try latest(hint) else { return nil }
            return LivePoolUpdate(
                poolHint: hint,
                quotaUsed: snap.usedPercent,
                quotaTotal: LiveConstants.percentTotal,
                resetAt: snap.resetAt,
                recordedAt: snap.recordedAt
            )
        }
    }

    public func series(pool: PoolHint, from: Date, to: Date) throws -> [QuotaSnapshot] {
        lock.lock()
        defer { lock.unlock() }
        let sql = """
        SELECT id, pool_hint, used_percent, remaining_percent, reset_at, recorded_at, is_anchor
        FROM snapshots
        WHERE pool_hint = ? AND recorded_at >= ? AND recorded_at <= ?
        ORDER BY recorded_at ASC
        """
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
            throw StoreError.queryFailed
        }
        defer { sqlite3_finalize(statement) }
        bind(statement, 1, pool.rawValue)
        bind(statement, 2, ISODates.format(from) ?? "")
        bind(statement, 3, ISODates.format(to) ?? "")
        var rows: [QuotaSnapshot] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            rows.append(row(statement))
        }
        return rows
    }

    /// Daily activity from local history: used% increase that day. Honest empty when no samples.
    public func dailyActivity(from: Date, to: Date, pool: PoolHint? = nil) throws -> [DailyActivity] {
        let calendar = Calendar(identifier: .gregorian)
        var days: [Date: (delta: Double, count: Int)] = [:]
        let hints = pool.map { [$0] } ?? PoolHint.allCases
        for hint in hints {
            let points = try series(pool: hint, from: from.addingTimeInterval(-24 * 60 * 60), to: to)
            guard !points.isEmpty else { continue }
            var previous = points[0]
            for point in points.dropFirst() {
                let day = calendar.startOfDay(for: point.recordedAt)
                let delta = max(0, point.usedPercent - previous.usedPercent)
                var bucket = days[day] ?? (0, 0)
                bucket.delta += delta
                bucket.count += 1
                days[day] = bucket
                previous = point
            }
            if points.count == 1 {
                let day = calendar.startOfDay(for: points[0].recordedAt)
                var bucket = days[day] ?? (0, 0)
                bucket.count += 1
                days[day] = bucket
            }
        }
        return days.keys.sorted().map { day in
            let bucket = days[day]!
            return DailyActivity(day: day, usedDelta: bucket.delta, sampleCount: bucket.count)
        }
    }

    public func heatmap(weeks: Int = 12, ending: Date = Date(), pool: PoolHint? = nil) throws -> [HeatmapCell] {
        let calendar = Calendar(identifier: .gregorian)
        let endDay = calendar.startOfDay(for: ending)
        let start = calendar.date(byAdding: .day, value: -(weeks * 7 - 1), to: endDay) ?? endDay
        let activity = try dailyActivity(from: start, to: ending, pool: pool)
        let byDay = Dictionary(uniqueKeysWithValues: activity.map { ($0.day, $0) })
        let peak = activity.map(\.usedDelta).max() ?? 0
        var cells: [HeatmapCell] = []
        var cursor = start
        while cursor <= endDay {
            let row = byDay[cursor]
            let intensity: Double
            if let row, peak > 0 {
                intensity = min(1, row.usedDelta / peak)
            } else if let row, row.sampleCount > 0 {
                intensity = 0.15
            } else {
                intensity = 0
            }
            cells.append(HeatmapCell(day: cursor, intensity: intensity, sampleCount: row?.sampleCount ?? 0))
            cursor = calendar.date(byAdding: .day, value: 1, to: cursor) ?? endDay.addingTimeInterval(86_400)
            if cursor == cells.last?.day { break }
        }
        return cells
    }

    public func idealPace(remainingStart: Double = 100, remainingEnd: Double = 0, steps: Int) -> [Double] {
        guard steps > 1 else { return [remainingStart] }
        return (0..<steps).map { index in
            let t = Double(index) / Double(steps - 1)
            return remainingStart + (remainingEnd - remainingStart) * t
        }
    }

    private func latestUnlocked(_ hint: PoolHint) throws -> QuotaSnapshot? {
        let sql = """
        SELECT id, pool_hint, used_percent, remaining_percent, reset_at, recorded_at, is_anchor
        FROM snapshots WHERE pool_hint = ? ORDER BY recorded_at DESC, id DESC LIMIT 1
        """
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
            throw StoreError.queryFailed
        }
        defer { sqlite3_finalize(statement) }
        bind(statement, 1, hint.rawValue)
        guard sqlite3_step(statement) == SQLITE_ROW else { return nil }
        return row(statement)
    }

    private func insertUnlocked(_ snapshot: QuotaSnapshot) throws {
        let sql = """
        INSERT INTO snapshots (pool_hint, used_percent, remaining_percent, reset_at, recorded_at, is_anchor)
        VALUES (?, ?, ?, ?, ?, ?)
        """
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
            throw StoreError.queryFailed
        }
        defer { sqlite3_finalize(statement) }
        bind(statement, 1, snapshot.poolHint.rawValue)
        sqlite3_bind_double(statement, 2, snapshot.usedPercent)
        sqlite3_bind_double(statement, 3, snapshot.remainingPercent)
        if let reset = ISODates.format(snapshot.resetAt) {
            bind(statement, 4, reset)
        } else {
            sqlite3_bind_null(statement, 4)
        }
        bind(statement, 5, ISODates.format(snapshot.recordedAt) ?? "")
        sqlite3_bind_int(statement, 6, snapshot.isAnchor ? 1 : 0)
        guard sqlite3_step(statement) == SQLITE_DONE else { throw StoreError.queryFailed }
    }

    private func row(_ statement: OpaquePointer) -> QuotaSnapshot {
        let id = sqlite3_column_int64(statement, 0)
        let hint = String(cString: sqlite3_column_text(statement, 1))
        let used = sqlite3_column_double(statement, 2)
        let remaining = sqlite3_column_double(statement, 3)
        let resetText = sqlite3_column_text(statement, 4).map { String(cString: $0) }
        let recordedText = String(cString: sqlite3_column_text(statement, 5))
        let anchor = sqlite3_column_int(statement, 6) == 1
        return QuotaSnapshot(
            id: id,
            poolHint: PoolHint(rawValue: hint) ?? .cursorModels,
            usedPercent: used,
            remainingPercent: remaining,
            resetAt: ISODates.parse(resetText),
            recordedAt: ISODates.parse(recordedText) ?? Date(),
            isAnchor: anchor
        )
    }

    private func bind(_ statement: OpaquePointer, _ index: Int32, _ text: String) {
        sqlite3_bind_text(statement, index, text, -1, unsafeBitCast(-1, to: sqlite3_destructor_type.self))
    }

    private func exec(_ sql: String) throws {
        var error: UnsafeMutablePointer<CChar>?
        let status = sqlite3_exec(db, sql, nil, nil, &error)
        if let error {
            let message = String(cString: error)
            sqlite3_free(error)
            if status != SQLITE_OK { throw StoreError.openFailed(message) }
        } else if status != SQLITE_OK {
            throw StoreError.openFailed("sqlite exec failed")
        }
    }

    public enum StoreError: Error, Equatable {
        case openFailed(String)
        case queryFailed
    }
}
