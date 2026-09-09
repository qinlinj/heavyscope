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
        .target(
            name: "HeavyScopeCore",
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
