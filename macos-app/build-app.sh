#!/bin/zsh
# Builds Sandbox Brain.app from the SPM executable — no Xcode project needed
# (same pattern as vitals/ledge). Run from macos-app/:
#   ./build-app.sh            → build/Sandbox Brain.app
#   ./build-app.sh install    → also copy to /Applications and launch
set -e
cd "$(dirname "$0")"

swift build -c release

APP="build/Sandbox Brain.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp .build/release/SandboxBrain "$APP/Contents/MacOS/SandboxBrain"
cp Resources/Info.plist "$APP/Contents/Info.plist"

# Icon: .icns fallback (regenerate with `swift tools/make-icon.swift`).
if [[ -f Resources/AppIcon.icns ]]; then
    cp Resources/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"
fi

# Liquid Glass icon: compile the Icon Composer document with actool (needs
# full Xcode — DEVELOPER_DIR overrides an xcode-select'd CLT). Same pattern
# as ledge. CFBundleIconName makes macOS 26 prefer it over the icns.
if [[ -d "SandboxBrain.icon" && -d /Applications/Xcode.app ]]; then
    # Absolute paths: actool's backing daemon caches ITS OWN cwd from first
    # launch, so relative paths can resolve against a different repo entirely.
    if ! DEVELOPER_DIR=/Applications/Xcode.app xcrun actool "$PWD/SandboxBrain.icon" \
        --compile "$PWD/$APP/Contents/Resources" \
        --platform macosx --minimum-deployment-target 26.0 \
        --app-icon SandboxBrain \
        --output-partial-info-plist "$PWD/build/icon-info.plist" > /tmp/actool-out.plist 2>&1; then
        echo "actool failed:" >&2
        cat /tmp/actool-out.plist >&2
        exit 1
    fi
    /usr/libexec/PlistBuddy -c "Add :CFBundleIconName string SandboxBrain" \
        "$APP/Contents/Info.plist" 2>/dev/null || true
    echo "Compiled Liquid Glass icon from SandboxBrain.icon"
fi

# Ad-hoc signature — fine for personal/team use. Teammates who download a zip
# built on another Mac right-click → Open the first time (Gatekeeper).
codesign --force --sign - "$APP"

echo "Built $APP"

if [[ "$1" == "install" ]]; then
    pkill -f 'Sandbox Brain.app/Contents/MacOS/SandboxBrain' || true
    sleep 1
    rm -rf "/Applications/Sandbox Brain.app"
    cp -R "$APP" "/Applications/Sandbox Brain.app"
    open "/Applications/Sandbox Brain.app"
    echo "Installed and launched /Applications/Sandbox Brain.app"
fi
