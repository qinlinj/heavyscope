import Foundation

/// Minimal JSON tree so live mappers can walk unofficial payloads without inventing fields.
public enum JSONValue: Equatable, Sendable {
    case object([String: JSONValue])
    case array([JSONValue])
    case string(String)
    case number(Double)
    case bool(Bool)
    case null

    public static func parse(_ data: Data) throws -> JSONValue {
        let raw = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
        return wrap(raw)
    }

    public static func parse(_ text: String) throws -> JSONValue {
        try parse(Data(text.utf8))
    }

    public var object: [String: JSONValue]? {
        if case let .object(value) = self { return value }
        return nil
    }

    public var array: [JSONValue]? {
        if case let .array(value) = self { return value }
        return nil
    }

    public var string: String? {
        if case let .string(value) = self { return value }
        return nil
    }

    public var bool: Bool? {
        if case let .bool(value) = self { return value }
        return nil
    }

    public var number: Double? {
        switch self {
        case let .number(value):
            return value
        case let .string(text):
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty, let parsed = Double(trimmed) else { return nil }
            return parsed
        default:
            return nil
        }
    }

    public subscript(_ key: String) -> JSONValue? {
        object?[key]
    }

    public func finiteNumber(_ key: String) -> Double? {
        self[key]?.number.flatMap { $0.isFinite ? $0 : nil }
    }

    static func wrap(_ raw: Any) -> JSONValue {
        switch raw {
        case let value as [String: Any]:
            return .object(value.mapValues { wrap($0) })
        case let value as [Any]:
            return .array(value.map(wrap))
        case let value as String:
            return .string(value)
        case let value as Bool:
            return .bool(value)
        case let value as NSNumber:
            return .number(value.doubleValue)
        case let value as Double:
            return .number(value)
        case let value as Int:
            return .number(Double(value))
        default:
            return .null
        }
    }
}

public enum JSONWalk {
    public static func isObject(_ value: JSONValue?) -> Bool {
        if case .object = value { return true }
        return false
    }

    public static func recordArray(_ value: JSONValue?) -> [[String: JSONValue]] {
        guard let items = value?.array else { return [] }
        return items.compactMap(\.object)
    }
}
