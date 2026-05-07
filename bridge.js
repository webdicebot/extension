;(function () {
  const BRIDGE_NAME = '[Web DiceBot Bridge]'

  // Prevent double-injection
  if (window.__wdbBridgeLoaded) return
  window.__wdbBridgeLoaded = true

  console.log(`${BRIDGE_NAME} Loaded on: ${location.hostname}`)

  // Mark the DOM so pages can detect the bridge
  document.documentElement.dataset.wdbBridgeLoaded = 'true'
  document.documentElement.dataset.wdbVersion = '1.0.5'

  // Announce bridge is ready after DOM is settled
  function announceReady() {
    document.dispatchEvent(
      new CustomEvent('WDB_BRIDGE_READY', {
        detail: { version: '1.0.5', host: location.hostname }
      })
    )
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    announceReady()
  } else {
    document.addEventListener('DOMContentLoaded', announceReady, { once: true })
  }

  // ─── Helpers ───────────────────────────────────────────────────

  function dispatch(eventName, detail) {
    document.dispatchEvent(new CustomEvent(eventName, { detail }))
  }

  function sendToBackground(message, callback) {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      callback({ success: false, message: 'Extension context is not available.' })
      return
    }
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const err = chrome.runtime.lastError
        if (err) {
          callback({ success: false, message: 'Extension error: ' + err.message })
          return
        }
        callback(response || { success: false, message: 'No response from extension.' })
      })
    } catch (e) {
      callback({ success: false, message: 'Connection failed: ' + (e?.message || 'Unknown error') })
    }
  }

  // ─── Event: WDB_INSTALL_SCRIPT ──────────────────────────────────
  // Save a new script to the extension storage.
  // Dispatch: new CustomEvent("WDB_INSTALL_SCRIPT", { detail: { name, content, language } })
  document.addEventListener('WDB_INSTALL_SCRIPT', (e) => {
    if (!e.detail) return
    const { name, content, language = 'lua' } = e.detail
    console.log(`${BRIDGE_NAME} WDB_INSTALL_SCRIPT: "${name}"`)

    sendToBackground({ action: 'installScript', script: { name, content, language } }, (res) =>
      dispatch('WDB_INSTALL_SCRIPT_RESULT', res)
    )
  })

  // ─── Event: WDB_UPDATE_SCRIPT ───────────────────────────────────
  // Update an existing script by name. Creates if not found.
  // Dispatch: new CustomEvent("WDB_UPDATE_SCRIPT", { detail: { name, content, language } })
  document.addEventListener('WDB_UPDATE_SCRIPT', (e) => {
    if (!e.detail) return
    const { name, content, language = 'lua' } = e.detail
    console.log(`${BRIDGE_NAME} WDB_UPDATE_SCRIPT: "${name}"`)

    sendToBackground({ action: 'updateScript', script: { name, content, language } }, (res) =>
      dispatch('WDB_UPDATE_SCRIPT_RESULT', res)
    )
  })

  // ─── Event: WDB_DELETE_SCRIPT ───────────────────────────────────
  // Delete a script from extension storage by name.
  // Dispatch: new CustomEvent("WDB_DELETE_SCRIPT", { detail: { name } })
  document.addEventListener('WDB_DELETE_SCRIPT', (e) => {
    if (!e.detail) return
    const { name } = e.detail
    console.log(`${BRIDGE_NAME} WDB_DELETE_SCRIPT: "${name}"`)

    sendToBackground({ action: 'deleteScript', name }, (res) =>
      dispatch('WDB_DELETE_SCRIPT_RESULT', res)
    )
  })

  // ─── Event: WDB_GET_SCRIPTS ─────────────────────────────────────
  // Retrieve all saved custom scripts.
  // Dispatch: new CustomEvent("WDB_GET_SCRIPTS")
  // Listen:   document.addEventListener("WDB_GET_SCRIPTS_RESULT", (e) => e.detail.scripts)
  document.addEventListener('WDB_GET_SCRIPTS', () => {
    console.log(`${BRIDGE_NAME} WDB_GET_SCRIPTS`)

    sendToBackground({ action: 'getScripts' }, (res) => dispatch('WDB_GET_SCRIPTS_RESULT', res))
  })

  // ─── Event: WDB_RUN_SCRIPT ──────────────────────────────────────
  // Load a saved script (by name) into the active bot editor.
  // Dispatch: new CustomEvent("WDB_RUN_SCRIPT", { detail: { name } })
  document.addEventListener('WDB_RUN_SCRIPT', (e) => {
    if (!e.detail) return
    const { name } = e.detail
    console.log(`${BRIDGE_NAME} WDB_RUN_SCRIPT: "${name}"`)

    sendToBackground({ action: 'getScripts' }, (res) => {
      if (!res.success) {
        dispatch('WDB_RUN_SCRIPT_RESULT', { success: false, message: res.message })
        return
      }
      const script = (res.scripts || []).find((s) => s.name === name)
      if (!script) {
        dispatch('WDB_RUN_SCRIPT_RESULT', {
          success: false,
          message: `Script "${name}" not found.`
        })
        return
      }

      // Put the content into the bot editor (works only when bot is running)
      const mode = window.mode
      if (mode === 'lua' && window.luaEditor) {
        window.luaEditor.setValue(script.content)
        dispatch('WDB_RUN_SCRIPT_RESULT', {
          success: true,
          message: `"${name}" loaded into Lua editor.`
        })
      } else if (mode === 'js' && window.jsEditor) {
        window.jsEditor.setValue(script.content)
        dispatch('WDB_RUN_SCRIPT_RESULT', {
          success: true,
          message: `"${name}" loaded into JS editor.`
        })
      } else {
        dispatch('WDB_RUN_SCRIPT_RESULT', {
          success: false,
          message: 'Bot editor not found. Is the bot running?'
        })
      }
    })
  })

  // ─── Event: WDB_UPDATE_SETTINGS ─────────────────────────────────
  // Update extension settings (API Token, License, API URL).
  // Dispatch: new CustomEvent("WDB_UPDATE_SETTINGS", { detail: { auth_token, license, wdb_api } })
  document.addEventListener('WDB_UPDATE_SETTINGS', (e) => {
    if (!e.detail) return
    const { auth_token, license, wdb_api } = e.detail
    console.log(`${BRIDGE_NAME} WDB_UPDATE_SETTINGS`)

    sendToBackground(
      { action: 'updateSettings', settings: { auth_token, license, wdb_api } },
      (res) => dispatch('WDB_UPDATE_SETTINGS_RESULT', res)
    )
  })

  console.log(
    `${BRIDGE_NAME} Ready — listening for: WDB_INSTALL_SCRIPT, WDB_UPDATE_SCRIPT, WDB_DELETE_SCRIPT, WDB_GET_SCRIPTS, WDB_RUN_SCRIPT, WDB_UPDATE_SETTINGS`
  )
})()
