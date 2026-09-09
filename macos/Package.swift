// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "HeavyScopeCore",
    platforms: [
        .macOS(.v13),
    ],
    // Linux `swift test` is supported for Core. The SwiftUI app is macOS-only.
    products: [
        .library(name: "HeavyScopeCore", targets: ["HeavyScopeCore"]),
    ],
    targets: [
        // Business logic is independently testable without loading the macOS UI.
        .systemLibrary(
            name: "CSQLite",
            path: "CSQLite",
            pkgConfig: "sqlite3",
            providers: [
                .apt(["libsqlite3-dev"]),
            ]
        ),
        .target(
            name: "HeavyScopeCore",
            dependencies: ["CSQLite"],
            path: "HeavyScope/Core",
            linkerSettings: [
                .linkedLibrary("sqlite3"),
            ]
        ),
        .testTarget(
            name: "HeavyScopeCoreTests",
            dependencies: ["HeavyScopeCore"],
            path: "Tests/HeavyScopeCoreTests"
        ),
    ]
)
