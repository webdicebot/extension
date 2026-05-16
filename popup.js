const authTokenInput = document.getElementById('auth-token')
const appInterface = document.getElementById('app-interface')
const branchTabs = document.querySelectorAll('.tab-btn')
const gameFilters = document.getElementById('game-filters')
const installerSelect = document.getElementById('installer-select')
const previewSection = document.getElementById('preview-section')
const scriptPreview = document.getElementById('script-preview')
const scriptTips = document.getElementById('script-tips')
const injectBtn = document.getElementById('inject-now')
const saveSettingsBtn = document.getElementById('save-settings')
const licenseInput = document.getElementById('license')
const wdbApiInput = document.getElementById('wdb-api')
const notificationToast = document.getElementById('notification-toast')
const currentVersionSpan = document.getElementById('current-version')
const updateBanner = document.getElementById('update-banner')
const updateLink = document.getElementById('update-link')

// CSP & Domain Elements
const cspToggle = document.getElementById('csp-toggle')
const activeToggle = document.getElementById('active-toggle')

const GITHUB_REPO = 'webdicebot/extension'

let apiData = []
let currentBranch = 'stable'
let currentGameType = 'all'
let customScripts = []

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get([
    'auth_token',
    'api_data',
    'wdb_api',
    'license',
    'active_branch',
    'custom_scripts',
    'active_game_type',
    'csp_disabled_domains',
    'always_active_domains'
  ])

  if (data.active_game_type) {
    currentGameType = data.active_game_type
  }

  // Handle CSP Toggle and current domain
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab && tab.url) {
    try {
      const url = new URL(tab.url)
      const domain = url.hostname

      const disabledDomains = data.csp_disabled_domains || []
      if (cspToggle) {
        cspToggle.checked = disabledDomains.includes(domain)
        cspToggle.addEventListener('change', async () => {
          const currentData = await chrome.storage.local.get('csp_disabled_domains')
          let domains = currentData.csp_disabled_domains || []
          if (cspToggle.checked) {
            if (!domains.includes(domain)) domains.push(domain)
          } else {
            domains = domains.filter((d) => d !== domain)
          }
          await chrome.storage.local.set({ csp_disabled_domains: domains })
          showToast(
            `CSP Bypass ${cspToggle.checked ? 'Enabled' : 'Disabled'} for ${domain} (Refresh page to apply)`,
            'success'
          )
        })
      }

      // Handle Always Active Toggle
      const activeDomains = data.always_active_domains || []
      if (activeToggle) {
        activeToggle.checked = activeDomains.includes(domain)
        activeToggle.addEventListener('change', async () => {
          const currentData = await chrome.storage.local.get('always_active_domains')
          let domains = currentData.always_active_domains || []
          if (activeToggle.checked) {
            if (!domains.includes(domain)) domains.push(domain)
          } else {
            domains = domains.filter((d) => d !== domain)
          }
          await chrome.storage.local.set({ always_active_domains: domains })
          showToast(
            `Always Active ${activeToggle.checked ? 'Enabled' : 'Disabled'} for ${domain} (Refresh page to apply)`,
            'success'
          )
        })
      }
    } catch (e) {
      if (cspToggle) cspToggle.disabled = true
    }
  }

  if (data.active_branch) {
    currentBranch = data.active_branch
    branchTabs.forEach((t) => {
      if (t.dataset.branch === currentBranch) t.classList.add('active')
      else t.classList.remove('active')
    })
  }

  showInterface()
  toggleView(currentBranch)

  if (data.custom_scripts) {
    customScripts = data.custom_scripts
  }
  renderScripts()

  if (data.auth_token) authTokenInput.value = data.auth_token
  if (data.license) licenseInput.value = data.license
  if (data.wdb_api) wdbApiInput.value = data.wdb_api
  else wdbApiInput.value = 'https://bot.webdicebot.net'

  const settingsSection = document.querySelector('.settings-group details')
  if ((!data.auth_token || !data.license) && currentBranch !== 'custom') {
    settingsSection.open = true
  }

  const manifest = chrome.runtime.getManifest()
  currentVersionSpan.textContent = manifest.version

  if (data.auth_token) {
    fetchApiData()
  } else if (data.api_data) {
    apiData = data.api_data
    renderFilters()
    updateList()
  } else {
    updateListNoToken()
  }

  checkUpdates()
})

async function checkUpdates() {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
    if (!response.ok) return
    const data = await response.json()
    const latestVersion = data.tag_name.replace('v', '')
    const currentVersion = chrome.runtime.getManifest().version
    if (isNewerVersion(currentVersion, latestVersion)) {
      updateBanner.classList.remove('hidden')
      updateLink.href = data.html_url
    }
  } catch (err) {}
}

function isNewerVersion(oldVer, newVer) {
  const oldParts = oldVer.split('.').map(Number)
  const newParts = newVer.split('.').map(Number)
  for (let i = 0; i < Math.max(oldParts.length, newParts.length); i++) {
    const a = oldParts[i] || 0
    const b = newParts[i] || 0
    if (a < b) return true
    if (a > b) return false
  }
  return false
}

async function fetchApiData() {
  const token = authTokenInput.value.trim()
  if (!token) return
  try {
    const branches = ['stable', 'beta']
    let allData = []
    for (const b of branches) {
      const resp = await fetch(`https://api.webdicebot.net/installer/branch/${b}`, {
        headers: { authorization: `Bearer ${token}` }
      })
      if (resp.ok) {
        const res = await resp.json()
        if (res.success) {
          allData = allData.concat(res.data.map((item) => ({ ...item, branch: b })))
        }
      }
    }
    if (allData.length > 0) {
      apiData = allData
      await chrome.storage.local.set({ api_data: apiData, auth_token: token })
      renderFilters()
      updateList()
    }
    fetchCustomScripts(token)
  } catch (err) {}
}

async function fetchCustomScripts(token) {
  try {
    const apiBase = 'https://api.webdicebot.net'
    const resp = await fetch(`${apiBase}/scripts`, {
      headers: { authorization: `Bearer ${token}` }
    })
    if (resp.ok) {
      const res = await resp.json()
      if (res.success && Array.isArray(res.data)) {
        customScripts = res.data.map((s) => ({
          id: s._id,
          name: s.name,
          content: s.content,
          language: s.language || 'lua'
        }))
        await chrome.storage.local.set({ custom_scripts: customScripts })
        renderScripts()
      }
    }
  } catch (err) {}
}

function showInterface() {
  appInterface.classList.remove('hidden')
}

function updateListNoToken() {
  if (currentBranch === 'custom') return
  installerSelect.innerHTML =
    '<option value="" disabled selected>⚠ Enter token in Settings</option>'
  previewSection.classList.add('hidden')
  gameFilters.innerHTML = ''
}

function showToast(message, type = '') {
  notificationToast.textContent = message
  notificationToast.className = 'notification-toast'
  if (type) notificationToast.classList.add(type)
  notificationToast.classList.remove('hidden')
  clearTimeout(window.toastTimer)
  window.toastTimer = setTimeout(() => {
    notificationToast.classList.add('hidden')
  }, 4000)
}

function renderFilters() {
  const types = ['all', ...new Set(apiData.map((item) => item.game))]
  gameFilters.innerHTML = ''
  types.forEach((type) => {
    const chip = document.createElement('div')
    chip.className = `chip ${type === currentGameType ? 'active' : ''}`
    chip.textContent = type.charAt(0).toUpperCase() + type.slice(1)
    chip.addEventListener('click', () => {
      currentGameType = type
      chrome.storage.local.set({ active_game_type: currentGameType })
      renderFilters()
      updateList()
    })
    gameFilters.appendChild(chip)
  })
}

function updateList() {
  const filtered = apiData.filter(
    (item) =>
      item.branch === currentBranch && (currentGameType === 'all' || item.game === currentGameType)
  )
  installerSelect.innerHTML = '<option value="">Select installer</option>'
  filtered.forEach((item) => {
    const opt = document.createElement('option')
    opt.value = item.CASINO_GAME
    opt.textContent = item.option || item.CASINO_GAME || 'Unknown'
    installerSelect.appendChild(opt)
  })

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) return
    try {
      const url = new URL(tabs[0].url)
      const domain = url.hostname
      const match = filtered.find((item) => item.site && domain.includes(item.site))
      if (match) {
        installerSelect.value = match.CASINO_GAME
        showPreview(match)
      }
    } catch (e) {}
  })
}

function showPreview(item) {
  const api = wdbApiInput.value || 'https://bot.webdicebot.net'
  const license = licenseInput.value || 'YOUR_LICENSE'
  const code = `const WDB_API = "${api}";\nconst CASINO_GAME = "${item.CASINO_GAME}";\n(async function () {\n  try {\n    let installer = await fetch(WDB_API + "/${item.branch || 'stable'}/init");\n    installer = await installer.text();\n    (0, eval)(installer);\n  } catch (error) {\n    alert("Refresh the page before reinstalling");\n  }\n})();\nlocalStorage.setItem("license", "${license}");`
  scriptPreview.textContent = code
  if (item.tips) {
    scriptTips.innerHTML = `<div class="tips-content"><span class="tips-icon">💡</span> ${item.tips}</div>`
    scriptTips.classList.remove('hidden')
  } else {
    scriptTips.classList.add('hidden')
  }
  previewSection.classList.remove('hidden')
}

branchTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    branchTabs.forEach((t) => t.classList.remove('active'))
    tab.classList.add('active')
    currentBranch = tab.dataset.branch
    chrome.storage.local.set({ active_branch: currentBranch })
    toggleView(currentBranch)
  })
})

function toggleView(branch) {
  const officialView = document.getElementById('official-view')
  const customScriptsView = document.getElementById('custom-scripts-view')
  const settingsGroup = document.querySelector('.settings-group')

  if (branch === 'custom') {
    officialView.classList.add('hidden')
    customScriptsView.classList.remove('hidden')
    settingsGroup.classList.add('hidden')
  } else {
    officialView.classList.remove('hidden')
    customScriptsView.classList.add('hidden')
    settingsGroup.classList.remove('hidden')
    if (apiData.length > 0) updateList()
    else updateListNoToken()
  }
}

installerSelect.addEventListener('change', () => {
  const selected = apiData.find((i) => i.CASINO_GAME === installerSelect.value)
  if (selected) showPreview(selected)
  else previewSection.classList.add('hidden')
})

injectBtn.addEventListener('click', async () => {
  const selectedGame = installerSelect.value
  if (!selectedGame) return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const checkResult = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => !!document.getElementById('wdbWrap')
  })
  if (checkResult[0].result) {
    showToast('Please refresh page before install')
    return
  }
  const selectedItem = apiData.find(
    (i) => i.CASINO_GAME === selectedGame && i.branch === currentBranch
  )
  if (!selectedItem) return
  const api = wdbApiInput.value || 'https://bot.webdicebot.net'
  const license = licenseInput.value || ''
  await chrome.storage.local.set({
    active_game: selectedGame,
    active_branch: currentBranch,
    wdb_api: api,
    license
  })

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: async (api, game, lic, branch) => {
      window.WDB_API = api
      window.CASINO_GAME = game
      window.localStorage.setItem('license', lic)
      try {
        let inst = await fetch(`${api}/${branch}/init`)
        inst = await inst.text()
        ;(0, eval)(inst)
      } catch (e) {
        alert(e.message)
      }
    },
    args: [api, selectedGame, license.trim(), currentBranch]
  })
  injectBtn.textContent = '🚀 Installed'
  setTimeout(() => (injectBtn.textContent = 'Install'), 2000)
})

saveSettingsBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({
    wdb_api: wdbApiInput.value,
    license: licenseInput.value,
    auth_token: authTokenInput.value
  })
  fetchApiData()
  saveSettingsBtn.textContent = '✅ SAVED'
  setTimeout(() => (saveSettingsBtn.textContent = 'SAVE'), 2000)
})

chrome.storage.onChanged.addListener((changes) => {
  if (changes.custom_scripts) {
    customScripts = changes.custom_scripts.newValue || []
    renderScripts()
  }
})

function renderScripts() {
  const smSelect = document.getElementById('sm-select')
  if (!smSelect) return
  smSelect.innerHTML = '<option value="">Select a script</option>'
  customScripts.forEach((script) => {
    const opt = document.createElement('option')
    opt.value = script.id
    opt.textContent = `[${script.language === 'javascript' ? 'JS' : 'LUA'}] ${script.name}`
    smSelect.appendChild(opt)
  })
}

const smPasteBtn = document.getElementById('sm-paste')
if (smPasteBtn) {
  smPasteBtn.addEventListener('click', () => {
    const smSelect = document.getElementById('sm-select')
    const selectedId = smSelect.value
    if (!selectedId) {
      showToast('Please select a script first')
      return
    }
    const script = customScripts.find((s) => s.id === selectedId)
    if (script) {
      runCustomScript(script)
    }
  })
}

async function runCustomScript(script) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab) return

  // Kiểm tra xem Bot đã được cài đặt chưa trước khi paste
  const checkResult = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => !!document.getElementById('wdbWrap')
  })

  if (!checkResult[0].result) {
    showToast('Web DiceBot is not installed', 'error')
    return
  }

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: (content) => {
      try {
        if (window.mode === 'lua' && window.luaEditor) window.luaEditor.setValue(content)
        else if (window.mode === 'js' && window.jsEditor) window.jsEditor.setValue(content)
        else alert('Editor not found inside Web DiceBot.')
      } catch (e) {
        alert(e.message)
      }
    },
    args: [script.content]
  })
  showToast(`🚀 ${script.name} pasted`)
}
