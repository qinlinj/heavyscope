import SwiftUI

/// Dual-ring menu-bar indicator. Outer = remaining quota; inner = time-to-reset.
struct MenuBarProgressView: View {
    var remaining: Double?
    var timeRemaining: Double?
    var usedLabel: String
    var caption: String

    var body: some View {
        HStack(spacing: 6) {
            ZStack {
                ring(progress: (remaining ?? 0) / 100, color: outerColor, line: 2.4)
                    .opacity(remaining == nil ? 0.18 : 1)
                if let timeRemaining {
                    ring(progress: timeRemaining / 100, color: Color(red: 0.35, green: 0.72, blue: 1.0), line: 1.6)
                        .padding(3.2)
                }
            }
            .frame(width: 18, height: 18)
            Text(usedLabel)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .monospacedDigit()
            Text(caption)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 2)
    }

    private var outerColor: Color {
        guard let remaining else { return .secondary }
        if remaining < 20 { return Color(red: 0.96, green: 0.45, blue: 0.35) }
        if remaining < 40 { return Color(red: 0.98, green: 0.78, blue: 0.25) }
        return Color(red: 0.45, green: 0.86, blue: 0.55)
    }

    private func ring(progress: Double, color: Color, line: CGFloat) -> some View {
        Circle()
            .stroke(color.opacity(0.22), lineWidth: line)
            .overlay(
                Circle()
                    .trim(from: 0, to: min(1, max(0, progress)))
                    .stroke(color, style: StrokeStyle(lineWidth: line, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            )
    }
}

enum MenuBarLabel {
    static func usedText(remaining: Double?) -> String {
        guard let remaining else { return "—" }
        return "\(Int(round(100 - remaining)))%"
    }
}
