(function () {
  console.log("[Web DiceBot] Bridge script loaded and ready");

  // Mark that the bridge is loaded so the website can detect it
  document.documentElement.dataset.wdbBridgeLoaded = "true";

  // Listen for install request from webpage
  document.addEventListener("WDB_INSTALL_SCRIPT", (event) => {
    const { name, content } = event.detail;
    console.log("[Web DiceBot] Received install request for:", name);

    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage(
          {
            action: "installScript",
            script: { name, content },
          },
          (response) => {
            const error = chrome.runtime.lastError;
            if (error) {
              console.error("[Web DiceBot] Runtime error:", error);
              sendResult(false, "Extension error: " + error.message);
              return;
            }
            
            console.log("[Web DiceBot] Response from background:", response);
            sendResult(response?.success || false, response?.message || "No response");
          },
        );
      } catch (e) {
        console.error("[Web DiceBot] Send message failed:", e);
        sendResult(false, "Failed to connect to extension: " + e.message);
      }
    } else {
      console.error("[Web DiceBot] Chrome runtime not available in bridge");
      sendResult(false, "Extension bridge is inactive. Please reload extension and refresh page.");
    }
  });

  function sendResult(success, message) {
    document.dispatchEvent(
      new CustomEvent("WDB_INSTALL_SCRIPT_RESULT", {
        detail: { success, message },
      }),
    );
  }
})();
