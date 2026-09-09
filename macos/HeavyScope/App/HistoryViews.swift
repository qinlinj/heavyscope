import SwiftUI

struct HistoryWindow: View {
    @ObservedObject var service: UsageService
    @State private var selectedPool: PoolHint = .cursorModels
    @State private var activityRange: ActivityRange = .days30

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                quotaCard
                activityCard
            }
            .padding(20)
        }
        .frame(minWidth: 720, minHeight: 640)
        .background(Color.black.opacity(0.92))
    }

    private var quotaCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(service.t("history.title"))
                        .font(.system(size: 20, weight: .semibold))
                    Text(service.t("history.subtitle"))
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Picker("", selection: $selectedPool) {
                    ForEach(PoolHint.allCases, id: \.self) { hint in
                        Text(L10n.poolName(hint, language: service.language)).tag(hint)
                    }
                }
                .labelsHidden()
                .frame(width: 200)
            }
            HStack(spacing: 24) {
                metric(
                    title: service.t("quota.remaining"),
                    value: remainingText,
                    accent: Color(red: 0.45, green: 0.92, blue: 0.88)
                )
                metric(
                    title: service.t("legend.actual"),
                    value: usedText,
                    accent: .white
                )
            }
            QuotaHistoryChart(points: quotaPoints, ideal: idealPoints)
                .frame(height: 220)
            HStack(spacing: 16) {
                legendSwatch(service.t("legend.actual"), dashed: true)
                legendSwatch(service.t("legend.ideal"), dashed: true)
                Text(service.t("history.empty"))
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 14).fill(Color.white.opacity(0.04)))
    }

    private var activityCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(service.t("activity.title"))
                    .font(.system(size: 20, weight: .semibold))
                Text(service.t("activity.subtitle"))
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            Picker("", selection: $activityRange) {
                ForEach(ActivityRange.allCases, id: \.self) { range in
                    Text(range.label).tag(range)
                }
            }
            .pickerStyle(.segmented)
            HStack(spacing: 24) {
                metric(title: activityRange.label, value: totalDelta, accent: Color(red: 0.45, green: 0.92, blue: 0.88))
                metric(title: "Latest", value: latestDelta, accent: .white)
                metric(title: "Peak", value: peakDelta, accent: .white)
            }
            TokenActivityChart(days: activity)
                .frame(height: 200)
            HeatmapGrid(cells: heatmap)
                .padding(.top, 8)
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 14).fill(Color.white.opacity(0.04)))
    }

    private var quotaPoints: [QuotaSnapshot] {
        let end = Date()
        let start = end.addingTimeInterval(-7 * 24 * 60 * 60)
        return (try? service.store.series(pool: selectedPool, from: start, to: end)) ?? []
    }

    private var idealPoints: [Double] {
        (try? service.store.idealPace(steps: max(quotaPoints.count, 2))) ?? [100, 0]
    }

    private var remainingText: String {
        if let last = quotaPoints.last {
            return "\(Int(round(last.remainingPercent)))%"
        }
        return service.t("history.empty")
    }

    private var usedText: String {
        if let last = quotaPoints.last {
            return "\(Int(round(last.usedPercent)))%"
        }
        return "—"
    }

    private var activity: [DailyActivity] {
        let end = Date()
        let start = end.addingTimeInterval(-activityRange.seconds)
        return (try? service.store.dailyActivity(from: start, to: end)) ?? []
    }

    private var heatmap: [HeatmapCell] {
        (try? service.store.heatmap(weeks: 16)) ?? []
    }

    private var totalDelta: String { formatDelta(activity.reduce(0) { $0 + $1.usedDelta }) }
    private var latestDelta: String { formatDelta(activity.last?.usedDelta) }
    private var peakDelta: String { formatDelta(activity.map(\.usedDelta).max()) }

    private func formatDelta(_ value: Double?) -> String {
        guard let value else { return "—" }
        return String(format: "%.1f%%", value)
    }

    private func metric(title: String, value: String, accent: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 28, weight: .semibold, design: .rounded))
                .foregroundStyle(accent)
        }
    }

    private func legendSwatch(_ title: String, dashed: Bool) -> some View {
        HStack(spacing: 6) {
            Capsule()
                .stroke(style: StrokeStyle(lineWidth: 1.5, dash: dashed ? [3, 3] : []))
                .foregroundStyle(Color(red: 0.45, green: 0.92, blue: 0.88))
                .frame(width: 16, height: 2)
            Text(title)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
        }
    }
}

enum ActivityRange: String, CaseIterable {
    case days7
    case days30
    case days90

    var seconds: TimeInterval {
        switch self {
        case .days7: return 7 * 86_400
        case .days30: return 30 * 86_400
        case .days90: return 90 * 86_400
        }
    }

    var label: String {
        switch self {
        case .days7: return "7 days"
        case .days30: return "30 days"
        case .days90: return "90 days"
        }
    }
}

struct QuotaHistoryChart: View {
    var points: [QuotaSnapshot]
    var ideal: [Double]

    var body: some View {
        GeometryReader { geo in
            ZStack {
                ForEach([0, 25, 50, 75, 100], id: \.self) { tick in
                    let y = geo.size.height * CGFloat(1 - Double(tick) / 100)
                    Path { path in
                        path.move(to: CGPoint(x: 0, y: y))
                        path.addLine(to: CGPoint(x: geo.size.width, y: y))
                    }
                    .stroke(Color.white.opacity(0.06), lineWidth: 1)
                }
                if points.count >= 2 {
                    Path { path in
                        for (index, value) in ideal.enumerated() {
                            let x = geo.size.width * CGFloat(index) / CGFloat(max(ideal.count - 1, 1))
                            let y = geo.size.height * CGFloat(1 - min(1, max(0, value / 100)))
                            if index == 0 { path.move(to: CGPoint(x: x, y: y)) }
                            else { path.addLine(to: CGPoint(x: x, y: y)) }
                        }
                    }
                    .stroke(Color(red: 0.45, green: 0.92, blue: 0.88).opacity(0.45), style: StrokeStyle(lineWidth: 1.2, dash: [4, 4]))
                    Path { path in
                        for (index, point) in points.enumerated() {
                            let x = geo.size.width * CGFloat(index) / CGFloat(points.count - 1)
                            let y = geo.size.height * CGFloat(1 - min(1, max(0, point.remainingPercent / 100)))
                            if index == 0 { path.move(to: CGPoint(x: x, y: y)) }
                            else { path.addLine(to: CGPoint(x: x, y: y)) }
                        }
                    }
                    .stroke(Color(red: 0.45, green: 0.92, blue: 0.88), style: StrokeStyle(lineWidth: 1.6, dash: [2, 4]))
                } else {
                    Text("No recorded data")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

struct TokenActivityChart: View {
    var days: [DailyActivity]

    var body: some View {
        GeometryReader { geo in
            if days.isEmpty {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.white.opacity(0.03))
                    .overlay(
                        Text("No recorded data")
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                    )
            } else {
                let peak = max(days.map(\.usedDelta).max() ?? 1, 0.0001)
                HStack(alignment: .bottom, spacing: 3) {
                    ForEach(days) { day in
                        Capsule()
                            .fill(Color(red: 0.45, green: 0.92, blue: 0.88))
                            .frame(width: max(3, geo.size.width / CGFloat(days.count) - 3), height: max(2, geo.size.height * CGFloat(day.usedDelta / peak)))
                    }
                }
            }
        }
    }
}
