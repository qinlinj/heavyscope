import Foundation

enum L10n {
    static func text(_ key: String, language: AppLanguage) -> String {
        (catalog[key]?[language] ?? catalog[key]?[.english]) ?? key
    }

    static func poolName(_ hint: PoolHint, language: AppLanguage) -> String {
        language == .simplifiedChinese ? hint.displayNameZH : hint.displayNameEN
    }

    static func pace(_ pace: ConsumptionPace, language: AppLanguage) -> String {
        switch pace {
        case .onTrack: return text("pace.onTrack", language: language)
        case .overPace: return text("pace.overPace", language: language)
        case .unavailable: return text("pace.unavailable", language: language)
        }
    }

    private static let catalog: [String: [AppLanguage: String]] = [
        "app.name": [.english: "HeavyScope", .simplifiedChinese: "HeavyScope"],
        "app.subtitle": [
            .english: "Local quota monitor",
            .simplifiedChinese: "本地额度监视",
        ],
        "status.notConnected": [
            .english: "Not connected",
            .simplifiedChinese: "待连接",
        ],
        "status.stale": [
            .english: "Showing last good snapshot",
            .simplifiedChinese: "显示上次成功快照",
        ],
        "status.updated": [
            .english: "Updated",
            .simplifiedChinese: "已更新",
        ],
        "quota.remaining": [
            .english: "Quota remaining",
            .simplifiedChinese: "剩余额度",
        ],
        "time.remaining": [
            .english: "Time remaining",
            .simplifiedChinese: "剩余时间",
        ],
        "reset.in": [
            .english: "Reset in",
            .simplifiedChinese: "重置倒计时",
        ],
        "reset.at": [
            .english: "Resets",
            .simplifiedChinese: "重置于",
        ],
        "pace.onTrack": [
            .english: "On pace",
            .simplifiedChinese: "节奏正常",
        ],
        "pace.overPace": [
            .english: "Above pace",
            .simplifiedChinese: "快于节奏",
        ],
        "pace.unavailable": [
            .english: "Pace unknown",
            .simplifiedChinese: "节奏未知",
        ],
        "history.title": [
            .english: "Quota History",
            .simplifiedChinese: "额度历史",
        ],
        "history.subtitle": [
            .english: "Current cycle from local snapshots",
            .simplifiedChinese: "来自本地快照的当前周期",
        ],
        "history.empty": [
            .english: "No recorded data",
            .simplifiedChinese: "暂无记录",
        ],
        "activity.title": [
            .english: "Daily Activity",
            .simplifiedChinese: "每日活动",
        ],
        "activity.subtitle": [
            .english: "Accumulated locally on this Mac",
            .simplifiedChinese: "在本机本地累计",
        ],
        "heatmap.title": [
            .english: "Activity heatmap",
            .simplifiedChinese: "活动热力图",
        ],
        "settings.title": [
            .english: "Settings",
            .simplifiedChinese: "设置",
        ],
        "settings.cursorToken": [
            .english: "WorkosCursorSessionToken",
            .simplifiedChinese: "WorkosCursorSessionToken",
        ],
        "settings.grokCookie": [
            .english: "grok.com session cookie",
            .simplifiedChinese: "grok.com 会话 Cookie",
        ],
        "settings.grokBearer": [
            .english: "Grok Bearer token",
            .simplifiedChinese: "Grok Bearer",
        ],
        "settings.interval": [
            .english: "Refresh interval",
            .simplifiedChinese: "刷新间隔",
        ],
        "settings.language": [
            .english: "Language",
            .simplifiedChinese: "语言",
        ],
        "settings.save": [
            .english: "Save",
            .simplifiedChinese: "保存",
        ],
        "settings.cursorHint": [
            .english: "Paste the cookie value from cursor.com. Stored in Keychain. Never committed.",
            .simplifiedChinese: "从 cursor.com 粘贴 Cookie 值。保存在钥匙串中，不会写入仓库。",
        ],
        "settings.grokHint": [
            .english: "Paste grok.com cookies and/or a Bearer. Heavy uses GetGrokCreditsConfig weekly credit %.",
            .simplifiedChinese: "粘贴 grok.com Cookie 和/或 Bearer。Heavy 使用 GetGrokCreditsConfig 每周积分百分比。",
        ],
        "action.refresh": [
            .english: "Refresh",
            .simplifiedChinese: "刷新",
        ],
        "action.quit": [
            .english: "Quit",
            .simplifiedChinese: "退出",
        ],
        "action.openHistory": [
            .english: "Open history",
            .simplifiedChinese: "打开历史",
        ],
        "legend.actual": [
            .english: "Actual quota",
            .simplifiedChinese: "实际额度",
        ],
        "legend.ideal": [
            .english: "Ideal pace",
            .simplifiedChinese: "理想节奏",
        ],
        "connect.cta": [
            .english: "Open Settings and paste a Cursor token or Grok cookie.",
            .simplifiedChinese: "打开设置，粘贴 Cursor Token 或 Grok Cookie。",
        ],
        "other.capCopy": [
            .english: "$400 is included cap copy, not used Other.",
            .simplifiedChinese: "$400 仅为 Included 上限文案，不是 Other 已用量。",
        ],
        "language.english": [
            .english: "English",
            .simplifiedChinese: "English",
        ],
        "language.chinese": [
            .english: "简体中文",
            .simplifiedChinese: "简体中文",
        ],
        "selection.tightest": [
            .english: "Tightest pool",
            .simplifiedChinese: "最紧的池",
        ],
    ]
}
