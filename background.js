// Cho phép mở Side Panel khi click vào icon extension
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('[WebDiceBot] SidePanel behavior error:', error));
}
