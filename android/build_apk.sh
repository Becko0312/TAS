#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Tool paths
SDK=/usr/lib/android-sdk
BUILD_TOOLS="$SDK/build-tools/29.0.3"
PLATFORM="$SDK/platforms/android-23"
ANDROID_JAR="$PLATFORM/android.jar"
AAPT="$BUILD_TOOLS/aapt"
ZIPALIGN="$BUILD_TOOLS/zipalign"
APKSIGNER="$BUILD_TOOLS/apksigner"
DX="/usr/lib/android-sdk/build-tools/debian/dx"

OUT=build
APP_NAME=itest
UNSIGNED="$OUT/${APP_NAME}-unsigned.apk"
ALIGNED="$OUT/${APP_NAME}-aligned.apk"
SIGNED="$OUT/${APP_NAME}.apk"
KEYSTORE=keystore/debug.keystore
KS_PASS=android
KEY_ALIAS=debug

echo "==> Clean build/"
rm -rf "$OUT"
mkdir -p "$OUT/classes" "$OUT/gen" keystore

# 1) Package resources -> compiled resources + R.java
echo "==> aapt: package resources"
"$AAPT" package -f -m \
  -J "$OUT/gen" \
  -M AndroidManifest.xml \
  -S res \
  -A assets \
  -I "$ANDROID_JAR" \
  -F "$UNSIGNED"

# 2) Compile Java sources (Java 8 target so dx can consume the bytecode)
echo "==> javac: compile sources"
find src "$OUT/gen" -name '*.java' > "$OUT/sources.txt"
javac -source 1.8 -target 1.8 \
  -bootclasspath "$ANDROID_JAR" \
  -classpath "$ANDROID_JAR" \
  -d "$OUT/classes" \
  @"$OUT/sources.txt"

# 3) Compile to DEX
echo "==> dx: build classes.dex"
"$DX" --dex --output="$OUT/classes.dex" "$OUT/classes"

# 4) Add classes.dex into the APK (aapt add is deprecated but works)
echo "==> aapt add: bundle classes.dex"
( cd "$OUT" && "$AAPT" add "${APP_NAME}-unsigned.apk" classes.dex >/dev/null )

# 5) Create debug keystore if missing
if [ ! -f "$KEYSTORE" ]; then
  echo "==> keytool: create debug keystore"
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=IT Test, OU=Dev, O=CSC, L=Ulaanbaatar, ST=UB, C=MN" >/dev/null 2>&1
fi

# 6) Align
echo "==> zipalign"
"$ZIPALIGN" -f 4 "$UNSIGNED" "$ALIGNED"

# 7) Sign with v1 + v2
echo "==> apksigner: sign"
"$APKSIGNER" sign \
  --ks "$KEYSTORE" \
  --ks-pass "pass:$KS_PASS" \
  --key-pass "pass:$KS_PASS" \
  --ks-key-alias "$KEY_ALIAS" \
  --out "$SIGNED" \
  "$ALIGNED"

echo "==> verify"
"$APKSIGNER" verify --print-certs "$SIGNED" | head -5

echo
echo "APK: $(pwd)/$SIGNED  ($(du -h "$SIGNED" | cut -f1))"
