# DeviousMud for Android

A thin native shell around the web client: one activity, one WebView, the whole
game bundled into `assets/game/index.html`. The APK is around 400 KB and works
with no network at all — the full simulation runs inside the WebView.

## Build the APK

You need the Android SDK. The easiest route is Android Studio (which installs
it for you); the command line works just as well if you already have it.

```bash
# 1. Bundle the current game into the app and regenerate launcher icons
cd ..            # the deviousmud project root
npm run android:sync

# 2. Build
cd android
./gradlew assembleDebug          # or: gradle assembleDebug

# 3. Install on a phone plugged in with USB debugging enabled
./gradlew installDebug           # or: adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to
your phone and tap it to install (Android will ask you to allow installs from
this source the first time).

### Using Android Studio instead

`File → Open` this `android/` folder, wait for the Gradle sync, press **Run**.
Run `npm run android:sync` first, and again whenever you change the game.

### No Gradle wrapper JAR?

This repository ships `gradle/wrapper/gradle-wrapper.properties` but not the
binary `gradle-wrapper.jar`. Either open the project once in Android Studio
(it writes the JAR itself), or generate it with a local Gradle:

```bash
cd android && gradle wrapper --gradle-version 8.11.1
```

## Release builds

The debug build is signed with Android's shared debug key — fine for your own
phone, not for distribution. For a release APK or AAB, create a keystore and add
a `signingConfig` to `app/build.gradle`:

```bash
keytool -genkey -v -keystore deviousmud.jks -keyalg RSA -keysize 2048 \
        -validity 10000 -alias deviousmud
./gradlew assembleRelease        # or bundleRelease for Play Store upload
```

## Multiplayer from the app

By default the app is solo: everything runs on the phone. To point it at a
DeviousMud server, set `SERVER` near the top of `MainActivity.java`:

```java
private static final String SERVER = "192.168.1.20:8080";   // PC on your network
// or
private static final String SERVER = "play.example.com";    // public server, https
```

The shell passes it to the game as `?server=…`, and the client remembers it.
Private addresses are reachable over plain http/ws (see
`res/xml/network_security_config.xml`); anything routable is required to use
https/wss, which is what you want across the internet.

## What is in here

| File | Purpose |
| --- | --- |
| `app/src/main/java/.../MainActivity.java` | The whole app: WebView setup, asset loading, immersive mode, back handling |
| `app/src/main/assets/game/index.html` | The bundled game (written by `npm run android:sync`) |
| `app/src/main/res/xml/network_security_config.xml` | Cleartext only for private addresses |
| `app/src/main/res/mipmap-*/` | Launcher icons (generated) |
| `app/build.gradle` | minSdk 24, targetSdk 35 |

Assets are served through `WebViewAssetLoader` on
`https://appassets.androidplatform.net/` rather than `file://`. That gives the
page a real secure origin, so `localStorage` (where solo progress is saved)
behaves normally and survives app updates.

## Don't want to build anything?

Two shortcuts that need no SDK:

* **Install the web app.** Open the hosted client in Chrome on the phone and use
  *Install app* (or the "Install on this device" button on the title screen).
  You get a home-screen icon, full screen, and offline play through the service
  worker — effectively the same result as this APK.
* **Just open the file.** Copy `dist/deviousmud.html` to the phone and open it
  from Downloads. One file, no install, plays offline.
