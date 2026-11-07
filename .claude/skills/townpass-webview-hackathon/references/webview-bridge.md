# TownPass WebView bridge

## Wire contract

The Flutter host registers a global object named `flutterObject`. The web page sends one string argument:

```js
window.flutterObject.postMessage(JSON.stringify({ name, data }))
```

The host reply, when a method replies, arrives as a message event whose `event.data` is also a JSON string with the same two keys. Register the reply listener before sending. With `addEventListener`, remove it when the component unmounts or the request ends.

The official guideline allows `onmessage` or `addEventListener('message', callback)`. Prefer `addEventListener` so unrelated features do not overwrite one another.

## Verified methods

| Name | Request `data` | Reply / behavior |
|---|---|---|
| `userinfo` | `null` | Account object or an empty value. Treat personal fields as sensitive. |
| `launch_map` | Map URL string | Boolean capability reply, then the host launches the URL when possible. |
| `phone_call` | Phone number string | Boolean capability reply, then the host opens the telephone URL when possible. |
| `1999agree` | Non-null value; the official example uses `true` | Opens terms if needed, then a voice-report Dialog. No reply when the Dialog is shown; `false` on unsupported calling or rejected terms. |
| `location` | `null` | Position object or an empty value when unavailable. |
| `deviceinfo` | `null` | Platform-specific iOS or Android device information. Do not depend on fields shared only by examples. |
| `open_link` | URL string | Opens the URL in the built-in WebView. No success reply; `false` when data is null. |
| `notify` | `{ title, content }` | Shows a device notification. No success reply; `false` for invalid data. Chinese `已訂閱xxx` and `已取消訂閱xxx` content also mutates the host subscription list. |
| `qr_code_scan` | `null` | Scanned string, or `null` when the user returns without scanning. |

## Defensive adapter

Create one adapter in `src/composables` or the project’s equivalent. It must:

- Check that `window.flutterObject?.postMessage` exists.
- Serialize exactly one `{ name, data }` object.
- Parse replies inside `try/catch` and validate `name` and expected data shape.
- Distinguish no-reply methods from request/reply methods.
- Support cancellation and cleanup on component unmount.
- Apply a timeout only to methods documented to reply. Treat timeout as unknown outcome, not failure of the native action.
- Keep mock behavior behind an explicit development flag. Production must not pretend that a native call succeeded.

Minimal type declaration:

```ts
declare global {
  interface Window {
    flutterObject?: {
      postMessage(message: string): void;
      addEventListener?(type: 'message', listener: (event: MessageEvent<string>) => void): void;
      removeEventListener?(type: 'message', listener: (event: MessageEvent<string>) => void): void;
      onmessage?: ((event: MessageEvent<string>) => void) | null;
    };
  }
}

export type TownPassMessage<Name extends string = string, Data = unknown> = {
  name: Name;
  data: Data;
};
```

## Test matrix

For each method used by the project, test valid data, malformed reply JSON, mismatched method name, empty data, permission denial, user cancellation, missing bridge, duplicate replies, late reply after unmount, and the method’s documented no-reply behavior.

Do not place real account, location, device, or scanned data in logs, screenshots, analytics, fixtures, or README examples.

When a required capability is not built in and the user has authorized a native TownPass change, follow [host-integration.md](host-integration.md) for custom handler registration, platform permissions, and end-to-end testing. A web-only task must not silently invent or add a native method.
