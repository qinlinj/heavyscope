import Foundation

/// Accepted four-pool live map for the native Mac app (HeavyScope 0.27).
/// Field table from sibling `docs/NATIVE_MAC_MAPPING.md` (PR #29). Swift-only.
/// Do not invent used / remaining / limit. Do not map `totalSpend` to Other.
public enum NativeMacMapping {
    public static let modelsField = "autoPercentUsed"
    public static let otherField = "apiPercentUsed"
    public static let botField = "usagePercent"
    public static let heavyJSONField = "creditUsagePercent"
    public static let heavyProtoField = 1
    public static let heavyProtoWire = 5
    public static let sandPath = LiveConstants.cursorSandPath
    public static let periodPath = LiveConstants.cursorPeriodPath
    public static let summaryPath = LiveConstants.cursorUsagePath
    public static let otherSourceNote = LiveConstants.otherSourceNote
    public static let includedCapCopyCents = LiveConstants.includedCapCopyCents

    public static func hint(forPresetId id: String) -> PoolHint? {
        PoolHint.allCases.first { $0.presetId == id }
    }
}
