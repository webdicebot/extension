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
  if (request.action === "installScript") {
    const { script } = request;
    chrome.storage.local.get(["custom_scripts"], (data) => {
      let scripts = data.custom_scripts || [];
      // Check if already exists by name
      if (!scripts.find((s) => s.name === script.name)) {
        scripts.push({
          id: Date.now().toString(),
          name: script.name,
          content: script.content,
        });
        chrome.storage.local.set({ custom_scripts: scripts }, () => {
          sendResponse({
            success: true,
            message: `Script "${script.name}" installed to extension!`,
          });
        });
      } else {
        sendResponse({
          success: false,
          message: `Script "${script.name}" is already in your extension.`,
        });
      }
    });
    return true; // Keep channel open for async response
  }
});
