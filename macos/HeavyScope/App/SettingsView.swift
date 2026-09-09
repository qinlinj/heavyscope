import SwiftUI

struct SettingsView: View {
    @ObservedObject var service: UsageService
    @State private var cursorToken = ""
    @State private var grokCookie = ""
    @State private var grokBearer = ""
    @State private var interval: Double = LiveConstants.defaultRefreshInterval
    @State private var language: AppLanguage = .simplifiedChinese

    var body: some View {
        Form {
            Section(service.t("settings.cursorToken")) {
                SecureField(service.t("settings.cursorToken"), text: $cursorToken)
                Text(service.t("settings.cursorHint"))
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            Section(service.t("settings.grokCookie")) {
                SecureField(service.t("settings.grokCookie"), text: $grokCookie)
                SecureField(service.t("settings.grokBearer"), text: $grokBearer)
                Text(service.t("settings.grokHint"))
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            Section(service.t("settings.interval")) {
                Picker(service.t("settings.interval"), selection: $interval) {
                    Text("30s").tag(30.0)
                    Text("60s").tag(60.0)
                    Text("5 min").tag(300.0)
                    Text("15 min").tag(900.0)
                }
                Picker(service.t("settings.language"), selection: $language) {
                    Text(service.t("language.english")).tag(AppLanguage.english)
                    Text(service.t("language.chinese")).tag(AppLanguage.simplifiedChinese)
                }
                Toggle(service.t("settings.showHistory"), isOn: showHistoryBinding)
                Toggle(service.t("settings.showActivity"), isOn: showActivityBinding)
            }
            Button(service.t("settings.save")) {
                service.saveSecrets(cursor: cursorToken, grokCookie: grokCookie, grokBearer: grokBearer)
                var prefs = service.preferences
                prefs.refreshInterval = interval
                prefs.language = language
                service.updatePreferences(prefs)
                Task { await service.refresh() }
            }
        }
        .formStyle(.grouped)
        .frame(width: 420, height: 480)
        .onAppear {
            cursorToken = service.secrets.get(.cursorSession) ?? ""
            grokCookie = service.secrets.get(.grokCookie) ?? ""
            grokBearer = service.secrets.get(.grokBearer) ?? ""
            interval = service.preferences.refreshInterval
            language = service.preferences.language
        }
    }

    private var showHistoryBinding: Binding<Bool> {
        Binding(
            get: { service.preferences.showQuotaHistory },
            set: { next in
                var prefs = service.preferences
                prefs.showQuotaHistory = next
                service.updatePreferences(prefs)
            }
        )
    }

    private var showActivityBinding: Binding<Bool> {
        Binding(
            get: { service.preferences.showTokenActivity },
            set: { next in
                var prefs = service.preferences
                prefs.showTokenActivity = next
                service.updatePreferences(prefs)
            }
        )
    }
}
