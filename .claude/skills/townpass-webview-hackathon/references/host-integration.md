# TownPass host integration

Read this reference only when adding a service to the Flutter host, changing native code, or introducing a custom `TPWebMessageHandler`. Web-only tasks should use the existing bridge contract without modifying the host.

## Refresh the native baseline

Inspect the current checkout before changing it. On 2026-10-26, the official repo declared Flutter `3.47.6` in `.fvmrc` and `flutter_inappwebview ^6.1.5` in `pubspec.yaml`. Treat these as a dated snapshot.

For the inspected checkout, the native setup flow is:

```sh
fvm install
fvm flutter pub get
fvm dart run build_runner build --delete-conflicting-outputs
fvm flutter run
```

Do not run `build_runner` until after new generated assets or models are in place. Review generated changes before committing them.

## Register a service

Use the current repo structure rather than copying a stale example:

1. Add an SVG under `assets/svg/` using the repo’s snake-case convention, then regenerate assets.
2. Add a unique value to `MyServiceItemId` in `lib/page/city_service/model/my_service_model.dart`.
3. Add the matching `MyServiceItem` switch branch with `title`, `description`, generated `icon`, `category`, and an HTTPS `destinationUrl`.
4. Use `forceWebViewTitle` only when the host must override the document title. Otherwise keep each web route’s `document.title` accurate so `TPWebView.onTitleChanged` can update the AppBar.
5. Run the app and add the service from the actual service list. Verify launch, title, web history back action, close action, reload, and return to the TownPass home flow.

The inspected categories are `cityService`, `healthCare`, `cityLife`, `explore`, and `other`. Re-read the enum before selecting one.

`trending_service_model.dart` controls the current popular-service list. The four official service-card widgets are native UI and some inspected `onTap` handlers remain TODOs. Change these placements only when the product request calls for them; a microservice does not automatically belong in Trending or the official collage.

## Add a custom native handler

Use a custom handler only when the capability cannot be delivered safely through an existing verified method.

1. Define a unique method name that does not collide with built-ins.
2. Subclass `TPWebMessageHandler` and validate `message`, `sourceOrigin`, and `isMainFrame` as required by the capability.
3. Return replies through `replyWebMessage(data: ...)` so the wire format remains `{ name, data }` JSON.
4. Register the handler in `TPWebMessageListener._cachedMessageHandlers`.
5. Add narrowly scoped iOS `Info.plist` usage descriptions and Android manifest permissions when required. Explain the user-facing purpose before requesting permission.
6. Document the request, reply, cancellation, denial, error, and no-reply behavior in the project README and web adapter types.

For hardware, health, audio, Bluetooth, NFC, Wi-Fi, camera, or on-device AI, test both supported platforms and a real device. Do not treat emulator success as hardware verification.

## Lifecycle and platform checks

- Remove web listeners, timers, observers, streams, and pending work when the view unmounts or the app backgrounds where applicable.
- Test iOS and Android window-opening behavior explicitly. Avoid relying on an unverified popup flow; use the verified host navigation path when possible.
- Exercise permission denial, cancellation, app background/foreground, low-memory recovery, WebView process termination where testable, and a second visit to catch duplicate listeners.
- Keep mock account and device data synthetic. Do not commit real identity, address, location, scanned, health, or device records.
