// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SandboxBrain",
    platforms: [.macOS("26.0")],
    dependencies: [
        .package(url: "https://github.com/supabase/supabase-swift.git", from: "2.0.0")
    ],
    targets: [
        .executableTarget(
            name: "SandboxBrain",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift")
            ],
            path: "Sources/SandboxBrain"
        ),
        .testTarget(
            name: "SandboxBrainTests",
            dependencies: ["SandboxBrain"],
            path: "Tests/SandboxBrainTests"
        )
    ]
)
