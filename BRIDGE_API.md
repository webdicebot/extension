# Web DiceBot Installer — Bridge API

The bridge is automatically injected into **every site** when a user install the extension.  
Your site can communicate with the extension using `CustomEvent` dispatched on `document`.

---

## 1. Detect the Bridge

```js
// Option 1: Check HTML attribute
if (document.documentElement.dataset.wdbBridgeLoaded === "true") {
  console.log("Bridge is ready!");
}

// Option 2: Listen for the WDB_BRIDGE_READY event
document.addEventListener("WDB_BRIDGE_READY", (e) => {
  console.log("Bridge ready — version:", e.detail.version);
});
```

---

## 2. Supported Events

### 📥 `WDB_INSTALL_SCRIPT` — Save a new script to the extension

```js
document.dispatchEvent(
  new CustomEvent("WDB_INSTALL_SCRIPT", {
    detail: {
      name: "My Lua Script", // (string, required) Display name
      content: "-- Lua code", // (string, required) Script content
      language: "lua", // "lua" | "javascript" (default: "lua")
    },
  }),
);

// Listen for the result
document.addEventListener("WDB_INSTALL_SCRIPT_RESULT", (e) => {
  console.log(e.detail.success, e.detail.message);
});
```

> Skips silently if a script with the same name already exists.

---

### ✏️ `WDB_UPDATE_SCRIPT` — Update an existing script by name (creates it if not found)

```js
document.dispatchEvent(
  new CustomEvent("WDB_UPDATE_SCRIPT", {
    detail: {
      name: "My Lua Script",
      content: "-- Updated code",
      language: "lua",
    },
  }),
);

document.addEventListener("WDB_UPDATE_SCRIPT_RESULT", (e) => {
  console.log(e.detail.success, e.detail.message);
});
```

---

### 🗑️ `WDB_DELETE_SCRIPT` — Delete a script by name

```js
document.dispatchEvent(
  new CustomEvent("WDB_DELETE_SCRIPT", {
    detail: { name: "My Lua Script" },
  }),
);

document.addEventListener("WDB_DELETE_SCRIPT_RESULT", (e) => {
  console.log(e.detail.success, e.detail.message);
});
```

---

### 📋 `WDB_GET_SCRIPTS` — Retrieve all saved scripts

```js
document.dispatchEvent(new CustomEvent("WDB_GET_SCRIPTS"));

document.addEventListener("WDB_GET_SCRIPTS_RESULT", (e) => {
  if (e.detail.success) {
    console.log("Scripts:", e.detail.scripts);
    // Returns: [{ id, name, content, language }, ...]
  }
});
```

---

### ▶️ `WDB_RUN_SCRIPT` — Load a saved script into the bot

> ⚠️ Only works when the bot has already been injected into the page (`window.luaEditor` or `window.jsEditor` must exist).

```js
document.dispatchEvent(
  new CustomEvent("WDB_RUN_SCRIPT", {
    detail: { name: "My Lua Script" },
  }),
);

document.addEventListener("WDB_RUN_SCRIPT_RESULT", (e) => {
  console.log(e.detail.success, e.detail.message);
});
```

---

## 3. Full Integration Example

```html
<button id="btn-add-script" disabled>Add Script to Extension</button>

<script>
  const btn = document.getElementById("btn-add-script");

  // Enable button once bridge is ready
  document.addEventListener("WDB_BRIDGE_READY", () => {
    btn.disabled = false;
  });

  btn.addEventListener("click", () => {
    document.dispatchEvent(
      new CustomEvent("WDB_INSTALL_SCRIPT", {
        detail: {
          name: "Auto Bet v1.0",
          content: `-- Auto Bet Script\nbet(0.00000001, "hi")\n`,
          language: "lua",
        },
      }),
    );
  });

  document.addEventListener("WDB_INSTALL_SCRIPT_RESULT", (e) => {
    alert(
      e.detail.success ? "✅ " + e.detail.message : "❌ " + e.detail.message,
    );
  });
</script>
```

---

## 4. How It Works

```
Your Webpage              bridge.js (content script)       background.js (service worker)
     │                           │                                  │
     │── dispatchEvent(WDB_*) ──>│                                  │
     │                           │── sendMessage(action) ──────────>│
     │                           │                                  │── read/write chrome.storage
     │                           │<─ response ──────────────────────│
     │<── dispatchEvent(WDB_*_RESULT)                               │
```

---

## 5. Event Reference Table

| Dispatch Event       | Response Event              | Description                               |
| -------------------- | --------------------------- | ----------------------------------------- |
| `WDB_BRIDGE_READY`   | _(no dispatch needed)_      | Fired when bridge finishes loading        |
| `WDB_INSTALL_SCRIPT` | `WDB_INSTALL_SCRIPT_RESULT` | Save a new script (skip if name exists)   |
| `WDB_UPDATE_SCRIPT`  | `WDB_UPDATE_SCRIPT_RESULT`  | Update script by name (create if missing) |
| `WDB_DELETE_SCRIPT`  | `WDB_DELETE_SCRIPT_RESULT`  | Delete a script by name                   |
| `WDB_GET_SCRIPTS`    | `WDB_GET_SCRIPTS_RESULT`    | Get all saved scripts as an array         |
| `WDB_RUN_SCRIPT`     | `WDB_RUN_SCRIPT_RESULT`     | Load script into the active bot editor    |

---

## 6. Result Object Shape

All `*_RESULT` events return a `detail` object with the same structure:

```ts
{
  success: boolean,   // true = operation succeeded
  message: string,    // Human-readable status message
  scripts?: Array<{   // Only present in WDB_GET_SCRIPTS_RESULT
    id: string,
    name: string,
    content: string,
    language: "lua" | "javascript"
  }>
}
```

---

## 7. Notes

- The bridge works **without a token or license** — no authentication required.
- All events must be dispatched and listened on **`document`** (not `window`).
- If the extension is reloaded or disabled, the user must **refresh the site** to restore the bridge.
- The bridge loads at `document_end`, so if your script runs before that, use `WDB_BRIDGE_READY` to gate your calls.
- The extension has `<all_urls>` host permission, so the bridge is available on **every site**.
