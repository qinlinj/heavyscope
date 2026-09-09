import Foundation

public enum ISODates {
    public static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    public static let isoFormatterNoFraction: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    public static func parse(_ value: JSONValue?) -> Date? {
        guard let value else { return nil }
        if let number = value.number {
            return fromEpoch(number)
        }
        if let text = value.string {
            return parse(text)
        }
        return nil
    }

    public static func parse(_ text: String?) -> Date? {
        guard let raw = text?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        if raw.allSatisfy(\.isNumber), let number = Double(raw) {
            return fromEpoch(number)
        }
        if let date = isoFormatter.date(from: raw) { return date }
        if let date = isoFormatterNoFraction.date(from: raw) { return date }
        return nil
    }

    public static func fromEpoch(_ value: Double) -> Date? {
        guard value.isFinite, value > 0 else { return nil }
        if value < 1e11 {
            return Date(timeIntervalSince1970: value)
        }
        return Date(timeIntervalSince1970: value / 1000)
    }

    public static func format(_ date: Date?) -> String? {
        guard let date else { return nil }
        return isoFormatter.string(from: date)
    }
}
