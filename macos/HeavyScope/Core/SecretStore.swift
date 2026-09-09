import Foundation

public enum SecretKey: String, CaseIterable, Sendable {
    case cursorSession = "cursor.session"
    case grokCookie = "grok.cookie"
    case grokBearer = "grok.bearer"
}

public protocol SecretStore: AnyObject, Sendable {
    func get(_ key: SecretKey) -> String?
    func set(_ key: SecretKey, value: String?) throws
}

/// In-memory store for unit tests. Never logs secret values.
public final class MemorySecretStore: SecretStore, @unchecked Sendable {
    private var values: [SecretKey: String] = [:]
    private let lock = NSLock()

    public init(_ seed: [SecretKey: String] = [:]) {
        values = seed
    }

    public func get(_ key: SecretKey) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return values[key]
    }

    public func set(_ key: SecretKey, value: String?) throws {
        lock.lock()
        defer { lock.unlock() }
        if let value, !value.isEmpty {
            values[key] = value
        } else {
            values.removeValue(forKey: key)
        }
    }
}

#if os(macOS)
import Security

/// Keychain-backed secrets. Tokens are never written to UserDefaults or git.
public final class KeychainSecretStore: SecretStore, @unchecked Sendable {
    private let service: String

    public init(service: String = "com.heavyscope.macos") {
        self.service = service
    }

    public func get(_ key: SecretKey) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public func set(_ key: SecretKey, value: String?) throws {
        let account = key.rawValue
        let delete: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(delete as CFDictionary)
        guard let value, !value.isEmpty, let data = value.data(using: .utf8) else { return }
        let add: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        let status = SecItemAdd(add as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.unhandled(status)
        }
    }

    public enum KeychainError: Error {
        case unhandled(OSStatus)
    }
}
#endif
