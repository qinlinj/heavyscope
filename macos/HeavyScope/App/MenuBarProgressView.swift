import SwiftUI

/// Status-item only. Outer remaining% of tightest connected pool (preset color).
/// Inner time-to-reset when known. Short integer remaining% label. No popover chrome.
struct MenuBarProgressView: View {
    var remaining: Double?
    var timeRemaining: Double?
    var accentHex: String?

    var body: some View {
        HStack(spacing: 5) {
            ZStack {
                ring(progress: (remaining ?? 0) / 100, color: Color(hex: accentHex ?? "#94A3B8"), line: 2.4)
                    .opacity(remaining == nil ? 0.18 : 1)
                if let timeRemaining {
                    ring(progress: timeRemaining / 100, color: Color(hex: LiveConstants.brandPurpleHex), line: 1.5)
                        .padding(3.2)
                }
            }
            .frame(width: 16, height: 16)
            Text(MenuBarIndicator.remainingLabel(remaining))
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .monospacedDigit()
        }
        .padding(.horizontal, 2)
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
