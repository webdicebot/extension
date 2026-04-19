chrome.runtime.onInstalled.addListener(() => {
  console.log('[Web DiceBot] Extension installed');
  updateCSPRules();
});

// Update CSP rules when storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.csp_disabled_domains) {
    updateCSPRules();
  }
});

async function updateCSPRules() {
  try {
    const data = await chrome.storage.local.get('csp_disabled_domains');
    const domains = data.csp_disabled_domains || [];

    const rules = [];
    if (domains.length > 0) {
      rules.push({
        id: 1,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [
            { header: 'content-security-policy', operation: 'remove' },
            { header: 'x-webkit-csp', operation: 'remove' },
            { header: 'content-security-policy-report-only', operation: 'remove' }
          ]
        },
        condition: {
          requestDomains: domains,
          resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest']
        }
      });
    }

    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [1],
      addRules: rules
    });
    console.log('[Web DiceBot] CSP Rules updated for domains:', domains);
  } catch (err) {
    console.error('[Web DiceBot] CSP Rules update failed:', err);
  }
}
