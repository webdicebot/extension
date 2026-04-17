// Selectors
const authTokenInput = document.getElementById('auth-token');
const appInterface = document.getElementById('app-interface');
const branchTabs = document.querySelectorAll('.tab-btn');
const gameFilters = document.getElementById('game-filters');
const installerSelect = document.getElementById('installer-select');
const previewSection = document.getElementById('preview-section');
const scriptPreview = document.getElementById('script-preview');
const injectBtn = document.getElementById('inject-now');
const saveSettingsBtn = document.getElementById('save-settings');
const licenseInput = document.getElementById('license');
const wdbApiInput = document.getElementById('wdb-api');
const notificationToast = document.getElementById('notification-toast');

let apiData = [];
let currentBranch = 'stable';
let currentGameType = 'all';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get(['auth_token', 'api_data', 'wdb_api', 'license']);

  if (data.auth_token) authTokenInput.value = data.auth_token;
  if (data.license) licenseInput.value = data.license;
  if (data.wdb_api) wdbApiInput.value = data.wdb_api;
  else wdbApiInput.value = 'https://bot.webdicebot.net';

  // Open settings automatically if credentials are missing
  const settingsSection = document.querySelector('.settings-group details');
  if (!data.auth_token || !data.license) {
    settingsSection.open = true;
  } else {
    settingsSection.open = false;
  }

  // Always try to fetch fresh data on load if token exists
  if (data.auth_token) {
    fetchApiData();
  } else if (data.api_data) {
    // Fallback to cached data if offline/no token change
    apiData = data.api_data;
    showInterface();
    renderFilters();
    updateList();
  }
});

async function fetchApiData() {
  const token = authTokenInput.value.trim();
  if (!token) return;

  try {
    const branches = ['stable', 'beta'];
    let allData = [];

    for (const b of branches) {
      const resp = await fetch(`https://api.webdicebot.net/installer/branch/${b}`, {
        headers: { "authorization": `Bearer ${token}` }
      });
      if (resp.ok) {
        const res = await resp.json();
        if (res.success) {
          allData = allData.concat(res.data.map(item => ({ ...item, branch: b })));
        }
      }
    }

    if (allData.length > 0) {
      apiData = allData;
      await chrome.storage.local.set({ api_data: apiData, auth_token: token });
      showInterface();
      renderFilters();
      updateList();
    }
  } catch (err) {
    console.error('[Web DiceBot] Fetch failed:', err);
  }
}

function showInterface() {
  appInterface.classList.remove('hidden');
}

function showToast(message) {
  notificationToast.textContent = message;
  notificationToast.classList.remove('hidden');

  // Auto hide after 4 seconds
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    notificationToast.classList.add('hidden');
  }, 4000);
}

function renderFilters() {
  const types = ['all', ...new Set(apiData.map(item => item.game))];
  gameFilters.innerHTML = '';
  types.forEach(type => {
    const chip = document.createElement('div');
    chip.className = `chip ${type === currentGameType ? 'active' : ''}`;
    chip.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    chip.addEventListener('click', () => {
      currentGameType = type;
      renderFilters();
      updateList();
    });
    gameFilters.appendChild(chip);
  });
}

function updateList() {
  console.log("[Web DiceBot] Updating list with", apiData.length, "items");

  const filtered = apiData.filter(item =>
    item.branch === currentBranch &&
    (currentGameType === 'all' || item.game === currentGameType)
  );

  installerSelect.innerHTML = '<option value="">Select installer</option>';

  if (filtered.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = "No scripts found";
    opt.disabled = true;
    installerSelect.appendChild(opt);
  }

  filtered.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.CASINO_GAME;
    opt.textContent = item.option || item.CASINO_GAME || "Unknown";
    installerSelect.appendChild(opt);
  });

  // Try auto-match by current tab domain
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) return;
    try {
      const url = new URL(tabs[0].url);
      const domain = url.hostname;
      console.log("[Web DiceBot] Auto-matching for domain:", domain);

      const match = filtered.find(item => item.site && domain.includes(item.site));
      if (match) {
        console.log("[Web DiceBot] Auto-match found:", match.CASINO_GAME);
        installerSelect.value = match.CASINO_GAME;
        showPreview(match);
      } else {
        console.log("[Web DiceBot] No auto-match for", domain);
        installerSelect.value = "";
        previewSection.classList.add('hidden');
      }
    } catch (e) {
      console.error("[Web DiceBot] URL parsing failed", e);
    }
  });
}

function showPreview(item) {
  if (!item) return;

  const api = wdbApiInput.value || 'https://bot.webdicebot.net';
  const license = licenseInput.value || 'YOUR_LICENSE';
  const branch = item.branch || currentBranch || 'stable';

  const code = `const WDB_API = "${api}";
const CASINO_GAME = "${item.CASINO_GAME}";
(async function () {
  try {
    let installer = await fetch(WDB_API + "/${branch}/init");
    installer = await installer.text();
    (0, eval)(installer);
  } catch (error) {
    alert("Refresh the page before reinstalling");
  }
})();
localStorage.setItem("license", "${license}");`;

  scriptPreview.textContent = code;
  previewSection.classList.remove('hidden');
}

// Events
branchTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    branchTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentBranch = tab.dataset.branch;
    updateList();
  });
});

installerSelect.addEventListener('change', () => {
  const selected = apiData.find(i => i.CASINO_GAME === installerSelect.value);
  if (selected) showPreview(selected);
  else previewSection.classList.add('hidden');
});

injectBtn.addEventListener('click', async () => {
  const selectedGame = installerSelect.value;
  if (!selectedGame) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Check if Bot is already installed by looking for #wdbWrap
  const checkResult = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => !!document.getElementById('wdbWrap')
  });

  if (checkResult[0].result) {
    showToast("Please refresh page before install");
    return;
  }

  // Search in apiData but match BOTH CASINO_GAME and the currentBranch
  const selectedItem = apiData.find(i => i.CASINO_GAME === selectedGame && i.branch === currentBranch);
  if (!selectedItem) return;

  const api = wdbApiInput.value || 'https://bot.webdicebot.net';
  const license = licenseInput.value || '';
  const branch = selectedItem.branch || currentBranch || 'stable';

  // 1. Persist the selection for future page loads
  await chrome.storage.local.set({
    active_game: selectedGame,
    active_branch: branch,
    wdb_api: api,
    license: license
  });

  // 2. Execute immediately in the current tab without refresh
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN', // Inject directly into page context
    func: async (wdbApi, casinoGame, licenseKey, branchName) => {
      // Khai báo biến toàn cục để script bot có thể tìm thấy
      window.WDB_API = wdbApi;
      window.CASINO_GAME = casinoGame;
      window.localStorage.setItem("license", licenseKey);

      try {
        let installer = await fetch(`${wdbApi}/${branchName}/init`);
        installer = await installer.text();
        (0, eval)(installer);
      } catch (error) {
        alert("Failed to inject script: " + error.message);
      }
    },
    args: [api, selectedGame, license.trim(), branch]
  });

  injectBtn.textContent = '🚀 Installed';
  setTimeout(() => injectBtn.textContent = 'Install', 2000);
});

// Listen for tab changes to update auto-match
chrome.tabs.onActivated.addListener(() => updateList());
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') updateList();
});

saveSettingsBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({
    wdb_api: wdbApiInput.value,
    license: licenseInput.value,
    auth_token: authTokenInput.value
  });

  // Fetch data immediately after saving new token
  fetchApiData();

  saveSettingsBtn.textContent = '✅ SAVED';
  setTimeout(() => saveSettingsBtn.textContent = 'SAVE', 2000);
});
