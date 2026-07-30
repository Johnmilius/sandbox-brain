// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SandboxBrain",
    platforms: [.macOS("26.0"), .iOS("26.0")],
    products: [
        .library(name: "SandboxBrainKit", targets: ["SandboxBrainKit"])
    ],
    dependencies: [
        .package(url: "https://github.com/supabase/supabase-swift.git", from: "2.0.0")
    ],
    targets: [
        // Platform-agnostic core (models, backends, state, theme tokens) —
        // shared by the macOS app today and the iOS app later.
        .target(
            name: "SandboxBrainKit",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift")
            ],
            path: "Sources/SandboxBrainKit"
        ),
        .executableTarget(
            name: "SandboxBrain",
            dependencies: ["SandboxBrainKit"],
            path: "Sources/SandboxBrain"
        ),
        .testTarget(
            name: "SandboxBrainTests",
            dependencies: ["SandboxBrainKit"],
            path: "Tests/SandboxBrainTests"
        )
    ]
)
