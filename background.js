chrome.runtime.onInstalled.addListener(() => {
  console.log("[Web DiceBot] Extension installed");
  updateCSPRules();
  updateAlwaysActiveRules();
});

// Update CSP rules when storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.csp_disabled_domains) {
    updateCSPRules();
  }
  if (changes.always_active_domains) {
    updateAlwaysActiveRules();
  }
});

async function updateCSPRules() {
  try {
    const data = await chrome.storage.local.get("csp_disabled_domains");
    const domains = data.csp_disabled_domains || [];

    const rules = [];
    if (domains.length > 0) {
      rules.push({
        id: 1,
        priority: 1,
        action: {
          type: "modifyHeaders",
          responseHeaders: [
            { header: "content-security-policy", operation: "remove" },
            { header: "x-webkit-csp", operation: "remove" },
            {
              header: "content-security-policy-report-only",
              operation: "remove",
            },
          ],
        },
        condition: {
          requestDomains: domains,
          resourceTypes: [
            "main_frame",
            "sub_frame",
            "script",
            "xmlhttprequest",
          ],
        },
      });
    }

    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [1],
      addRules: rules,
    });
    console.log("[Web DiceBot] CSP Rules updated for domains:", domains);
  } catch (err) {
    console.error("[Web DiceBot] CSP Rules update failed:", err);
  }
}

async function updateAlwaysActiveRules() {
  try {
    const data = await chrome.storage.local.get("always_active_domains");
    const domains = data.always_active_domains || [];

    // Unregister existing script first if it exists
    try {
      await chrome.scripting.unregisterContentScripts({
        ids: ["always-active-script"],
      });
    } catch (e) {
      // Ignore if not registered
    }

    if (domains.length > 0) {
      const patterns = domains.map((d) => `*://${d}/*`);

      await chrome.scripting.registerContentScripts([
        {
          id: "always-active-script",
          matches: patterns,
          js: ["always-active-inject.js"],
          runAt: "document_start",
          world: "MAIN",
        },
      ]);
      console.log(
        "[Web DiceBot] Always Active Rules updated for domains:",
        domains,
      );
    }
  } catch (err) {
    console.error("[Web DiceBot] Always Active Rules update failed:", err);
  }
}

// Handle messages from content scripts (bridge)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // ── installScript: add new script (skip if name exists) ──────────
  if (request.action === "installScript") {
    const { script } = request;
    chrome.storage.local.get(["custom_scripts"], (data) => {
      let scripts = data.custom_scripts || [];
      if (scripts.find((s) => s.name === script.name)) {
        sendResponse({ success: false, message: `Script "${script.name}" already exists.` });
        return;
      }
      scripts.push({
        id: Date.now().toString(),
        name: script.name,
        content: script.content,
        language: script.language || "lua",
      });
      chrome.storage.local.set({ custom_scripts: scripts }, () => {
        sendResponse({ success: true, message: `Script "${script.name}" installed!` });
      });
    });
    return true;
  }

  // ── updateScript: update existing by name, create if not found ───
  if (request.action === "updateScript") {
    const { script } = request;
    chrome.storage.local.get(["custom_scripts"], (data) => {
      let scripts = data.custom_scripts || [];
      const idx = scripts.findIndex((s) => s.name === script.name);
      if (idx !== -1) {
        scripts[idx].content = script.content;
        scripts[idx].language = script.language || scripts[idx].language || "lua";
        chrome.storage.local.set({ custom_scripts: scripts }, () => {
          sendResponse({ success: true, message: `Script "${script.name}" updated!` });
        });
      } else {
        // Create new if not found
        scripts.push({
          id: Date.now().toString(),
          name: script.name,
          content: script.content,
          language: script.language || "lua",
        });
        chrome.storage.local.set({ custom_scripts: scripts }, () => {
          sendResponse({ success: true, message: `Script "${script.name}" created!` });
        });
      }
    });
    return true;
  }

  // ── deleteScript: remove by name ─────────────────────────────────
  if (request.action === "deleteScript") {
    const { name } = request;
    chrome.storage.local.get(["custom_scripts"], (data) => {
      let scripts = data.custom_scripts || [];
      const before = scripts.length;
      scripts = scripts.filter((s) => s.name !== name);
      if (scripts.length === before) {
        sendResponse({ success: false, message: `Script "${name}" not found.` });
        return;
      }
      chrome.storage.local.set({ custom_scripts: scripts }, () => {
        sendResponse({ success: true, message: `Script "${name}" deleted.` });
      });
    });
    return true;
  }

  // ── getScripts: return all saved custom scripts ───────────────────
  if (request.action === "getScripts") {
    chrome.storage.local.get(["custom_scripts"], (data) => {
      sendResponse({ success: true, scripts: data.custom_scripts || [] });
    });
    return true;
  }
});
