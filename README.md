# 🎲 Web DiceBot Installer — Chrome Extension

> **Quick install Web DiceBot and more!**

---

## 📖 Overview

**Web DiceBot Installer** is a Chrome extension that lets you:

- ✅ Install a dice bot into any casino site with **one click**
- ✅ Manage your personal **script library** (Lua / JavaScript)
- ✅ Disable **CSP** on sites that block external scripts
- ✅ Keep the bot **Always Active** even when you switch tabs or minimize the window
- ✅ **Bridge API** — lets any website integrate directly with the extension

---

## 🚀 Key Features

### 1. Bot Installer (Stable / Beta tabs)

Pick a casino site, select a script, press **Install** — the bot is injected directly into the page.

### 2. Script Manager (Scripts tab)

- **Add / Edit / Delete** personal scripts
- **Import / Export** your script list (`.json` file)
- **Drag & drop** to reorder scripts
- Works **completely without a Token or License**

### 3. CSP Bypass

Toggle **Disable CSP** to strip Content Security Policy headers on the current page — allowing the bot to load on highly secured sites.

### 4. Always Active

Toggle **Always Active** to prevent the page from detecting tab switches or window minimization — the bot keeps running uninterrupted.

### 5. Bridge API

The bridge is automatically injected into **every site**. It lets any developer integrate with the extension:

- Save scripts into the extension
- Update / Delete scripts by name
- Load a script from extension to the bot

→ See [BRIDGE_API.md](./BRIDGE_API.md) for full documentation.

---

## 📦 Installation

### Manual Install (Developer Mode)

1. Download latest version `.zip` file from [Releases Page](https://github.com/webdicebot/extension/releases)
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the `extension/` folder
5. The extension icon appears in your toolbar ✅

---

## ⚙️ Configuration

Open the extension popup → expand **Settings**:

| Field                     | Description                       |
| ------------------------- | --------------------------------- |
| **Web DiceBot API Token** | Your webdicebot.net account token |
| **License**               | Your license key                  |

> 💡 The **Scripts tab** works fully without Token and License.

---

## 🏢 About

> Product of [webdicebot.net](https://webdicebot.net)
