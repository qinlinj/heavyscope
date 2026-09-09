import AppKit
import SwiftUI

/// Leader popover: A header · B hero · C four rows · D canvas · E footer.
/// ~360 wide, hairline dividers, no card/shadow stack. Heatmap at the bottom only.
struct ContentView: View {
    @ObservedObject var service: UsageService

    var body: some View {
        VStack(spacing: 0) {
            header
            hairline
            ScrollView {
                VStack(spacing: 0) {
                    hero
                    hairline
                    ForEach(PoolHint.popoverOrder, id: \.self) { hint in
                        PoolRow(service: service, hint: hint)
                    }
                    if service.preferences.showQuotaHistory || service.preferences.showTokenActivity {
                        hairline
                        bottomCanvas
                    }
                    hairline
                    heatmapStrip
                }
            }
            hairline
            footer
        }
        .frame(width: LiveConstants.popoverWidth)
        .frame(maxHeight: 640)
        .background(Color.black.opacity(0.72))
    }

    private var header: some View {
        HStack(spacing: 10) {
            Text(service.t("app.name"))
                .font(.system(size: 13, weight: .semibold))
            Spacer()
            Button {
                Task { await service.refresh() }
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .buttonStyle(.plain)
            .disabled(service.isRefreshing)
            .help(service.t("action.refresh"))
            Button {
                service.showSettings = true
            } label: {
                Image(systemName: "gear")
            }
            .buttonStyle(.plain)
            .help(service.t("settings.title"))
        }
        .font(.system(size: 13, weight: .medium))
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private var hero: some View {
        Group {
            if let pool = service.tightest {
                VStack(alignment: .leading, spacing: 6) {
                    Text(MenuBarIndicator.usedLabel(pool.usedPercent))
                        .font(.system(size: 28, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(usageTone(pool.usedPercent))
                    HStack(spacing: 6) {
                        Circle().fill(Color(hex: pool.poolHint.accentHex)).frame(width: 7, height: 7)
                        Text(pool.poolHint.shortName)
                            .font(.system(size: 12, weight: .medium))
                        if let reset = pool.resetAt {
                            Text(reset.countdownText)
                                .font(.system(size: 11))
                                .foregroundStyle(.secondary)
                        }
                        Text(L10n.pace(pool.pace(), language: service.language))
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(paceTone(pool.pace()))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
            } else {
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
        }
    }

    private var bottomCanvas: some View {
        VStack(alignment: .leading, spacing: 8) {
            if service.preferences.showQuotaHistory {
                Text(service.t("history.title"))
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
                MiniQuotaCurves(series: remainingCurves)
                    .frame(height: 44)
                    .onTapGesture { service.showHistory = true }
            }
            if service.preferences.showTokenActivity {
                Text(service.t("activity.title"))
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
                MiniActivityChart(days: activityDays)
                    .frame(height: 36)
                    .onTapGesture { service.showHistory = true }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private var heatmapStrip: some View {
        HeatmapGrid(cells: heatmapCells)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
    }

    private var footer: some View {
        HStack {
            Text(footerText)
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
    }

    private var hairline: some View {
        Rectangle()
            .fill(Color.white.opacity(0.08))
            .frame(height: 1)
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

    private var remainingCurves: [(PoolHint, [Double])] {
        let end = Date()
        let start = end.addingTimeInterval(-7 * 24 * 60 * 60)
        return PoolHint.popoverOrder.compactMap { hint in
            guard service.connectedHints.contains(hint) else { return nil }
            let points = ((try? service.store.series(pool: hint, from: start, to: end)) ?? []).map(\.remainingPercent)
            return points.isEmpty ? nil : (hint, points)
        }
    }

    private var activityDays: [Double] {
        let end = Date()
        let start = end.addingTimeInterval(-30 * 24 * 60 * 60)
        return ((try? service.store.dailyActivity(from: start, to: end, unit: LiveConstants.percentUnit)) ?? [])
            .map(\.usedDelta)
    }

    private var heatmapCells: [HeatmapCell] {
        (try? service.store.heatmap(weeks: 16)) ?? []
    }
}

struct PoolRow: View {
    @ObservedObject var service: UsageService
    var hint: PoolHint

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(Color(hex: hint.accentHex))
                .frame(width: 7, height: 7)
            Text(hint.shortName)
                .font(.system(size: 11, weight: .medium))
                .frame(width: 52, alignment: .leading)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.08))
                    if let pool {
                        Capsule()
                            .fill(Color(hex: hint.accentHex))
                            .frame(width: max(2, geo.size.width * CGFloat(min(1, max(0, pool.usedPercent / 100)))))
                    }
                }
            }
            .frame(height: 4)
            Group {
                if let pool {
                    VStack(alignment: .trailing, spacing: 1) {
                        Text(MenuBarIndicator.remainingLabel(pool.remainingPercent))
                            .foregroundStyle(usageTone(pool.usedPercent))
                        if let reset = pool.resetAt {
                            Text(reset.countdownText)
                                .foregroundStyle(.secondary)
                        }
                    }
                } else {
                    Text(service.t("status.pending"))
                        .foregroundStyle(.secondary)
                }
            }
            .font(.system(size: 10))
            .monospacedDigit()
            .frame(width: 58, alignment: .trailing)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
    }

    private var pool: LivePoolUpdate? { service.pool(hint) }
}

struct MiniQuotaCurves: View {
    var series: [(PoolHint, [Double])]

    var body: some View {
        GeometryReader { geo in
            if series.isEmpty {
                Rectangle().fill(Color.white.opacity(0.04))
            } else {
                ForEach(series, id: \.0) { hint, points in
                    Path { path in
                        guard points.count >= 2 else { return }
                        for (index, value) in points.enumerated() {
                            let x = geo.size.width * CGFloat(index) / CGFloat(points.count - 1)
                            let y = geo.size.height * CGFloat(1 - min(1, max(0, value / 100)))
                            if index == 0 { path.move(to: CGPoint(x: x, y: y)) }
                            else { path.addLine(to: CGPoint(x: x, y: y)) }
                        }
                    }
                    .stroke(Color(hex: hint.accentHex), lineWidth: 1.2)
                }
            }
        }
    }
}

struct MiniActivityChart: View {
    var days: [Double]

    var body: some View {
        GeometryReader { geo in
            if days.isEmpty {
                Rectangle().fill(Color.white.opacity(0.04))
            } else {
                let peak = max(days.max() ?? 1, 0.0001)
                HStack(alignment: .bottom, spacing: 2) {
                    ForEach(Array(days.enumerated()), id: \.offset) { _, value in
                        Capsule()
                            .fill(Color(hex: LiveConstants.brandPurpleHex).opacity(0.85))
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
        HStack(alignment: .top, spacing: 2) {
            ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
                VStack(spacing: 2) {
                    ForEach(week) { cell in
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(Color(hex: LiveConstants.brandPurpleHex).opacity(cell.sampleCount == 0 ? 0.08 : 0.16 + cell.intensity * 0.84))
                            .aspectRatio(1, contentMode: .fit)
                            .frame(minWidth: 8, minHeight: 8)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

func usageTone(_ usedPercent: Double) -> Color {
    if usedPercent >= 90 { return Color(red: 0.96, green: 0.45, blue: 0.35) }
    if usedPercent >= 70 { return Color(red: 0.98, green: 0.78, blue: 0.25) }
    return .white
}

func paceTone(_ pace: ConsumptionPace) -> Color {
    switch pace {
    case .onTrack: return Color(red: 0.45, green: 0.86, blue: 0.55)
    case .overPace: return Color(red: 0.98, green: 0.78, blue: 0.25)
    case .unavailable: return .secondary
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
        if days > 0 { return "\(days)d \(hours)h" }
        if hours > 0 { return "\(hours)h \(minutes)m" }
        return "\(minutes)m"
    }

    var shortStamp: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: self)
    }
}
