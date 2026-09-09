import AppKit
import SwiftUI

struct ContentView: View {
    @ObservedObject var service: UsageService

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider().opacity(0.18)
            ScrollView {
                VStack(spacing: 0) {
                    if !service.hasAnyCredential {
                        connectBanner
                        sectionDivider
                    }
                    ForEach(PoolHint.allCases, id: \.self) { hint in
                        QuotaSectionView(service: service, hint: hint)
                        sectionDivider
                    }
                    compactHistory
                    sectionDivider
                    compactActivity
                    sectionDivider
                    heatmapPreview
                    sectionDivider
                    settingsRow
                }
            }
            footer
        }
        .frame(width: 380)
        .frame(maxHeight: 720)
        .background(.ultraThinMaterial)
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text(service.t("app.name"))
                    .font(.system(size: 16, weight: .semibold))
                Text(service.t("app.subtitle"))
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                Task { await service.refresh() }
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 13, weight: .semibold))
            }
            .buttonStyle(.plain)
            .disabled(service.isRefreshing)
            .help(service.t("action.refresh"))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private var connectBanner: some View {
        Button {
            service.showSettings = true
        } label: {
            Text(service.t("connect.cta"))
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
        }
        .buttonStyle(.plain)
    }

    private var compactHistory: some View {
        Button {
            service.showHistory = true
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(service.t("history.title"))
                        .font(.system(size: 12, weight: .semibold))
                    Text(historyCaption)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                    MiniQuotaChart(points: historyPoints)
                        .frame(height: 42)
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(12)
        }
        .buttonStyle(.plain)
    }

    private var compactActivity: some View {
        Button {
            service.showHistory = true
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(service.t("activity.title"))
                        .font(.system(size: 12, weight: .semibold))
                    Text(service.t("activity.subtitle"))
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                    MiniActivityChart(days: activityDays)
                        .frame(height: 42)
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(12)
        }
        .buttonStyle(.plain)
    }

    private var heatmapPreview: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(service.t("heatmap.title"))
                .font(.system(size: 12, weight: .semibold))
            HeatmapGrid(cells: heatmapCells)
        }
        .padding(12)
    }

    private var settingsRow: some View {
        Button {
            service.showSettings = true
        } label: {
            HStack {
                Image(systemName: "gear")
                Text(service.t("settings.title"))
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.tertiary)
            }
            .font(.system(size: 12, weight: .medium))
            .padding(12)
        }
        .buttonStyle(.plain)
    }

    private var footer: some View {
        HStack {
            Text(footerText)
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
            Spacer()
            Button(service.t("action.quit")) {
                NSApp.terminate(nil)
            }
            .buttonStyle(.plain)
            .font(.system(size: 11, weight: .medium))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    private var sectionDivider: some View {
        Divider().opacity(0.12)
    }

    private var historyCaption: String {
        if let remaining = service.rings().outerRemaining {
            return "\(Int(round(remaining)))% · \(service.t("history.subtitle"))"
        }
        return service.t("history.empty")
    }

    private var footerText: String {
        if service.stale {
            return service.t("status.stale")
        }
        if let last = service.lastUpdated {
            let formatter = DateFormatter()
            formatter.dateStyle = .none
            formatter.timeStyle = .short
            return "\(service.t("status.updated")) \(formatter.string(from: last))"
        }
        return service.t("status.notConnected")
    }

    private var historyPoints: [Double] {
        let end = Date()
        let start = end.addingTimeInterval(-7 * 24 * 60 * 60)
        let hint = service.rings().label ?? .cursorModels
        return ((try? service.store.series(pool: hint, from: start, to: end)) ?? [])
            .map(\.remainingPercent)
    }

    private var activityDays: [Double] {
        let end = Date()
        let start = end.addingTimeInterval(-30 * 24 * 60 * 60)
        return ((try? service.store.dailyActivity(from: start, to: end)) ?? [])
            .map(\.usedDelta)
    }

    private var heatmapCells: [HeatmapCell] {
        (try? service.store.heatmap(weeks: 12)) ?? []
    }
}

struct QuotaSectionView: View {
    @ObservedObject var service: UsageService
    var hint: PoolHint

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(L10n.poolName(hint, language: service.language))
                    .font(.system(size: 13, weight: .semibold))
                Spacer()
                if let pool {
                    Label(L10n.pace(pool.pace(), language: service.language), systemImage: paceIcon)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(paceColor)
                        .labelStyle(.titleAndIcon)
                } else {
                    Text(service.t("status.notConnected"))
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
            }
            if let pool {
                meter(
                    title: service.t("quota.remaining"),
                    value: pool.remainingPercent,
                    color: Color(hex: hint.accentHex),
                    icon: "battery.100"
                )
                if let time = pool.remainingTimePercent() {
                    meter(
                        title: service.t("time.remaining"),
                        value: time,
                        color: Color(red: 0.35, green: 0.72, blue: 1.0),
                        icon: "clock"
                    )
                }
                HStack {
                    if let reset = pool.resetAt {
                        Label("\(service.t("reset.in")) \(reset.countdownText)", systemImage: "hourglass")
                        Spacer()
                        Text("\(service.t("reset.at")): \(reset.shortStamp)")
                    }
                }
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                if hint == .cursorOther {
                    Text(service.t("other.capCopy"))
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(12)
    }

    private var pool: LivePoolUpdate? { service.pool(hint) }

    private var paceIcon: String {
        guard let pool else { return "questionmark.circle" }
        switch pool.pace() {
        case .onTrack: return "checkmark.circle.fill"
        case .overPace: return "exclamationmark.triangle.fill"
        case .unavailable: return "minus.circle"
        }
    }

    private var paceColor: Color {
        guard let pool else { return .secondary }
        switch pool.pace() {
        case .onTrack: return Color(red: 0.45, green: 0.86, blue: 0.55)
        case .overPace: return Color(red: 0.98, green: 0.78, blue: 0.25)
        case .unavailable: return .secondary
        }
    }

    private func meter(title: String, value: Double, color: Color, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Label(title, systemImage: icon)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(Int(round(value)))%")
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.primary.opacity(0.08))
                    Capsule()
                        .fill(color)
                        .frame(width: max(4, geo.size.width * CGFloat(min(1, max(0, value / 100)))))
                }
            }
            .frame(height: 6)
        }
    }
}

struct MiniQuotaChart: View {
    var points: [Double]

    var body: some View {
        GeometryReader { geo in
            if points.count < 2 {
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color.primary.opacity(0.04))
                    .overlay(
                        Text("—")
                            .font(.system(size: 10))
                            .foregroundStyle(.tertiary)
                    )
            } else {
                Path { path in
                    for (index, value) in points.enumerated() {
                        let x = geo.size.width * CGFloat(index) / CGFloat(points.count - 1)
                        let y = geo.size.height * CGFloat(1 - min(1, max(0, value / 100)))
                        if index == 0 { path.move(to: CGPoint(x: x, y: y)) }
                        else { path.addLine(to: CGPoint(x: x, y: y)) }
                    }
                }
                .stroke(Color(red: 0.35, green: 0.72, blue: 1.0), style: StrokeStyle(lineWidth: 1.2, dash: [2, 3]))
            }
        }
    }
}

struct MiniActivityChart: View {
    var days: [Double]

    var body: some View {
        GeometryReader { geo in
            if days.isEmpty {
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color.primary.opacity(0.04))
            } else {
                let peak = max(days.max() ?? 1, 0.0001)
                HStack(alignment: .bottom, spacing: 2) {
                    ForEach(Array(days.enumerated()), id: \.offset) { _, value in
                        Capsule()
                            .fill(Color(red: 0.35, green: 0.72, blue: 1.0))
                            .frame(width: max(2, geo.size.width / CGFloat(max(days.count, 1)) - 2), height: max(2, geo.size.height * CGFloat(value / peak)))
                    }
                }
            }
        }
    }
}

struct HeatmapGrid: View {
    var cells: [HeatmapCell]

    var body: some View {
        let weeks = stride(from: 0, to: cells.count, by: 7).map { index in
            Array(cells[index..<min(index + 7, cells.count)])
        }
        HStack(alignment: .top, spacing: 3) {
            ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
                VStack(spacing: 3) {
                    ForEach(week) { cell in
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color(red: 0.22, green: 0.72, blue: 0.45).opacity(cell.sampleCount == 0 ? 0.08 : 0.18 + cell.intensity * 0.82))
                            .frame(width: 10, height: 10)
                    }
                }
            }
        }
    }
}

extension Color {
    init(hex: String) {
        var value = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        if value.count == 6 { value = "FF" + value }
        var int: UInt64 = 0
        Scanner(string: value).scanHexInt64(&int)
        self.init(
            .sRGB,
            red: Double((int >> 16) & 0xFF) / 255,
            green: Double((int >> 8) & 0xFF) / 255,
            blue: Double(int & 0xFF) / 255,
            opacity: Double((int >> 24) & 0xFF) / 255
        )
    }
}

extension Date {
    var countdownText: String {
        let remaining = max(0, timeIntervalSinceNow)
        let days = Int(remaining / 86_400)
        let hours = Int(remaining.truncatingRemainder(dividingBy: 86_400) / 3600)
        let minutes = Int(remaining.truncatingRemainder(dividingBy: 3600) / 60)
        if days > 0 { return "\(days) d \(hours) h" }
        if hours > 0 { return "\(hours) h \(minutes) min" }
        return "\(minutes) min"
    }

    var shortStamp: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: self)
    }
}
