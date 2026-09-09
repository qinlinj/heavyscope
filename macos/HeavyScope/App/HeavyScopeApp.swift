import SwiftUI

@main
struct HeavyScopeApp: App {
    @StateObject private var service = UsageService()

    var body: some Scene {
        MenuBarExtra {
            ContentView(service: service)
                .onAppear { service.start() }
                .background(WindowOpener(service: service))
        } label: {
            let rings = service.rings()
            MenuBarProgressView(
                remaining: rings.outerRemaining,
                timeRemaining: rings.innerTimeRemaining,
                usedLabel: MenuBarLabel.usedText(remaining: rings.outerRemaining),
                caption: rings.label.map { L10n.poolName($0, language: service.language) } ?? "HeavyScope"
            )
        }
        .menuBarExtraStyle(.window)

        Window(service.t("history.title"), id: "history") {
            HistoryWindow(service: service)
        }
        .defaultSize(width: 780, height: 720)
        .windowResizability(.contentMinSize)

        Window(service.t("settings.title"), id: "settings") {
            SettingsView(service: service)
        }
        .defaultSize(width: 440, height: 520)
        .windowResizability(.contentSize)
    }
}

private struct WindowOpener: View {
    @ObservedObject var service: UsageService
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Color.clear
            .frame(width: 0, height: 0)
            .onChange(of: service.showSettings) { open in
                if open {
                    openWindow(id: "settings")
                    service.showSettings = false
                }
            }
            .onChange(of: service.showHistory) { open in
                if open {
                    openWindow(id: "history")
                    service.showHistory = false
                }
            }
    }
}
