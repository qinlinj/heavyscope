import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct LiveHTTPResponse: Equatable, Sendable {
    public var status: Int
    public var bodyText: String
    public var bodyBytes: Data
    public var headers: [String: String]

    public init(status: Int, bodyText: String, bodyBytes: Data? = nil, headers: [String: String] = [:]) {
        self.status = status
        self.bodyText = bodyText
        self.bodyBytes = bodyBytes ?? Data(bodyText.utf8)
        self.headers = headers
    }
}

public protocol LiveHTTPTransport: Sendable {
    func send(
        url: URL,
        method: String,
        headers: [String: String],
        body: Data?
    ) async throws -> LiveHTTPResponse
}

public enum LiveHTTPError: Error, Equatable {
    case network(String)
}

public struct URLSessionLiveTransport: LiveHTTPTransport, @unchecked Sendable {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func send(
        url: URL,
        method: String,
        headers: [String: String],
        body: Data?
    ) async throws -> LiveHTTPResponse {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        do {
            let (data, response) = try await data(for: request)
            let http = response as? HTTPURLResponse
            let status = http?.statusCode ?? 0
            var headerMap: [String: String] = [:]
            http?.allHeaderFields.forEach { key, value in
                headerMap[String(describing: key).lowercased()] = String(describing: value)
            }
            return LiveHTTPResponse(
                status: status,
                bodyText: String(data: data, encoding: .utf8) ?? "",
                bodyBytes: data,
                headers: headerMap
            )
        } catch {
            throw LiveHTTPError.network(error.localizedDescription)
        }
    }

    private func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        #if canImport(FoundationNetworking)
        try await withCheckedThrowingContinuation { continuation in
            let task = session.dataTask(with: request) { data, response, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let data, let response else {
                    continuation.resume(throwing: LiveHTTPError.network("Empty response"))
                    return
                }
                continuation.resume(returning: (data, response))
            }
            task.resume()
        }
        #else
        try await session.data(for: request)
        #endif
    }
}

public struct LiveClient: Sendable {
    private let transport: LiveHTTPTransport

    public init(transport: LiveHTTPTransport) {
        self.transport = transport
    }

    public func fetchCursor(token: String, now: Date = Date()) async -> LiveProviderResult {
        let cookie = CursorMapper.cookieHeader(token)
        guard !cookie.isEmpty else {
            return .failure(.invalid, "Cursor session token is empty")
        }

        async let periodRes = cursorJSON(
            method: "POST",
            path: LiveConstants.cursorPeriodPath,
            cookie: cookie,
            body: Data("{}".utf8),
            label: "Cursor current-period-usage"
        )
        async let summaryRes = cursorJSON(
            method: "GET",
            path: LiveConstants.cursorUsagePath,
            cookie: cookie,
            body: nil,
            label: "Cursor usage-summary"
        )
        async let sandRes = cursorJSON(
            method: "POST",
            path: LiveConstants.cursorSandPath,
            cookie: cookie,
            body: Data(CursorMapper.sandUsageRequestBody().utf8),
            label: "Cursor sand-usage-status"
        )

        let periodParsed = await periodRes
        if let error = periodParsed.error, error.code == .expired { return error }
        let summaryParsed = await summaryRes
        if let error = summaryParsed.error, error.code == .expired { return error }
        let sandParsed = await sandRes

        let period = periodParsed.json
        let summary = summaryParsed.json
        let window = CursorMapper.resolveBillingWindow(period: period, summary: summary, now: now)
        let startMs = Int64(window.start.timeIntervalSince1970 * 1000)
        let endMs = Int64(window.end.timeIntervalSince1970 * 1000)

        let aggParsed = await cursorJSON(
            method: "POST",
            path: LiveConstants.cursorAggregatedPath,
            cookie: cookie,
            body: Data(CursorMapper.aggregatedUsageRequestBody(startMs: startMs, endMs: endMs).utf8),
            label: "Cursor aggregated-usage-events"
        )
        if let error = aggParsed.error, error.code == .expired { return error }

        let sandBot = sandParsed.json.flatMap { CursorMapper.mapSandUsage($0) }
        let aggregations = aggParsed.json
        var eventsParsed: CursorJSONParse?
        if sandBot == nil,
           CursorMapper.mapGrokBotFromRows(aggregations, resetAt: window.resetAt, recordedAt: now) == nil
        {
            eventsParsed = await cursorJSON(
                method: "POST",
                path: LiveConstants.cursorFilteredPath,
                cookie: cookie,
                body: Data(CursorMapper.filteredUsageRequestBody(startMs: startMs, endMs: endMs).utf8),
                label: "Cursor filtered-usage-events"
            )
        }

        let merged = CursorMapper.finishLiveRefresh(
            period: period,
            summary: summary,
            aggregations: aggregations,
            eventsParsed: eventsParsed,
            sandParsed: sandParsed,
            recordedAt: now
        )
        if merged.ok { return merged }
        if let error = periodParsed.error, error.code != .invalid { return error }
        if let error = summaryParsed.error, error.code != .invalid { return error }
        if let error = aggParsed.error, error.code != .invalid { return error }
        return merged
    }

    public func fetchGrok(cookie: String?, bearer: String?, now: Date = Date()) async -> LiveProviderResult {
        let cookieHeader = cookie.map(GrokMapper.cookieHeader) ?? ""
        let bearerToken = bearer.map(GrokMapper.normalizeBearer) ?? ""
        if cookieHeader.isEmpty && bearerToken.isEmpty {
            return .failure(.invalid, "Grok session cookie or bearer token is empty")
        }

        var headers = [
            "Content-Type": "application/grpc-web+proto",
            "Accept": "application/grpc-web+proto",
            "X-Grpc-Web": "1",
            "Origin": LiveConstants.grokOrigin,
            "Referer": "\(LiveConstants.grokOrigin)/",
            "User-Agent": LiveConstants.browserUserAgent,
        ]
        if !bearerToken.isEmpty { headers["Authorization"] = "Bearer \(bearerToken)" }
        if !cookieHeader.isEmpty { headers["Cookie"] = cookieHeader }

        let proto: LiveProviderResult
        do {
            let url = URL(string: LiveConstants.grokOrigin + LiveConstants.grokCreditsPath)!
            let response = try await transport.send(
                url: url,
                method: "POST",
                headers: headers,
                body: GrokMapper.grpcWebEmptyBody()
            )
            proto = GrokMapper.mapCreditsResponse(
                status: response.status,
                body: response.bodyBytes,
                headers: response.headers
            )
        } catch {
            proto = .failure(.network, "Grok credits network error")
        }

        guard !bearerToken.isEmpty else { return proto }

        do {
            let url = URL(string: LiveConstants.grokCliOrigin + LiveConstants.grokCliBillingPath)!
            var cliHeaders = [
                "Authorization": "Bearer \(bearerToken)",
                "x-xai-token-auth": LiveConstants.grokCliTokenAuth,
                "Accept": "application/json",
                "User-Agent": LiveConstants.browserUserAgent,
            ]
            if !cookieHeader.isEmpty { cliHeaders["Cookie"] = cookieHeader }
            let response = try await transport.send(url: url, method: "GET", headers: cliHeaders, body: nil)
            let json = GrokMapper.mapCLIBillingResponse(status: response.status, bodyText: response.bodyText)
            return GrokMapper.mergeLiveResults(proto, json)
        } catch {
            return proto.ok ? proto : .failure(.network, "Grok CLI billing network error")
        }
    }

    public func refreshAll(
        cursorToken: String?,
        grokCookie: String?,
        grokBearer: String?,
        lastGood: [LivePoolUpdate],
        now: Date = Date()
    ) async -> (pools: [LivePoolUpdate], cursor: LiveProviderResult?, grok: LiveProviderResult?, stale: Bool) {
        var merged: [PoolHint: LivePoolUpdate] = Dictionary(uniqueKeysWithValues: lastGood.map { ($0.poolHint, $0) })
        var stale = false
        var cursorResult: LiveProviderResult?
        var grokResult: LiveProviderResult?

        if let cursorToken, !cursorToken.isEmpty {
            let result = await fetchCursor(token: cursorToken, now: now)
            cursorResult = result
            if result.ok {
                for pool in result.pools { merged[pool.poolHint] = pool }
            } else {
                stale = true
            }
        }

        if (grokCookie?.isEmpty == false) || (grokBearer?.isEmpty == false) {
            let result = await fetchGrok(cookie: grokCookie, bearer: grokBearer, now: now)
            grokResult = result
            if result.ok {
                for pool in result.pools where pool.poolHint == .grokHeavy {
                    merged[pool.poolHint] = pool
                }
            } else {
                stale = true
            }
        }

        return (PoolHint.allCases.compactMap { merged[$0] }, cursorResult, grokResult, stale)
    }

    private func cursorJSON(
        method: String,
        path: String,
        cookie: String,
        body: Data?,
        label: String
    ) async -> CursorJSONParse {
        var headers = [
            "Cookie": cookie,
            "User-Agent": LiveConstants.browserUserAgent,
            "Accept": "application/json",
            "Origin": LiveConstants.cursorOrigin,
            "Referer": LiveConstants.cursorSpendingReferer,
        ]
        if body != nil { headers["Content-Type"] = "application/json" }
        do {
            let url = URL(string: LiveConstants.cursorOrigin + path)!
            let response = try await transport.send(url: url, method: method, headers: headers, body: body)
            if let statusError = CursorMapper.mapHTTPStatus(status: response.status, label: label, body: response.bodyText),
               statusError.code == .expired
            {
                return .error(statusError)
            }
            return CursorMapper.parseJSONBody(status: response.status, body: response.bodyText, label: label)
        } catch {
            return .error(.failure(.network, "\(label) network error"))
        }
    }
}
