(function () {
  const BRIDGE_NAME = "[Web DiceBot Bridge]";
  console.log(`${BRIDGE_NAME} script loaded and ready`);

  // Mark that the bridge is loaded so the website can detect it
  document.documentElement.dataset.wdbBridgeLoaded = "true";

  function sendResult(success, message) {
    console.log(`${BRIDGE_NAME} Sending result:`, { success, message });
    document.dispatchEvent(
      new CustomEvent("WDB_INSTALL_SCRIPT_RESULT", {
        detail: { success, message },
      }),
    );
  }

  // Listen for install request from webpage
  document.addEventListener("WDB_INSTALL_SCRIPT", (event) => {
    console.log(`${BRIDGE_NAME} Event received:`, event);
    
    if (!event.detail) {
      console.warn(`${BRIDGE_NAME} Event detail is missing!`);
      return;
    }

    const { name, content, language } = event.detail;
    console.log(`${BRIDGE_NAME} Data for "${name}" (${language})`);

    // Check if chrome runtime is still alive
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
      console.error(`${BRIDGE_NAME} Extension context is dead or missing.`);
      sendResult(false, "Extension is not active. Please reload extension and refresh the web page.");
      return;
    }

    try {
      console.log(`${BRIDGE_NAME} Communicating with background...`);
      chrome.runtime.sendMessage(
        {
          action: "installScript",
          script: { name, content, language },
        },
        (response) => {
          // Check for runtime errors first
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            console.error(`${BRIDGE_NAME} Runtime error:`, lastError);
            sendResult(false, "Extension error: " + lastError.message);
            return;
          }

          console.log(`${BRIDGE_NAME} Response received:`, response);
          if (response) {
            sendResult(response.success, response.message);
          } else {
            sendResult(false, "No response from extension background.");
          }
        },
      );
    } catch (err) {
      console.error(`${BRIDGE_NAME} Exception during sendMessage:`, err);
      const msg = (err && err.message) ? err.message : "Context invalidated. Please refresh the page.";
      sendResult(false, "Connection failed: " + msg);
    }
  });
})();
