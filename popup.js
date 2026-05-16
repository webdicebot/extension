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

// Modal Elements
const confirmModal = document.getElementById('confirm-modal')
const confirmTitle = document.getElementById('confirm-title')
const confirmMessage = document.getElementById('confirm-message')
const confirmYesBtn = document.getElementById('confirm-yes')
const confirmNoBtn = document.getElementById('confirm-no')

const GITHUB_REPO = 'webdicebot/extension'

let apiData = []
let currentBranch = 'stable'
let currentGameType = 'all'

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

  // Always show the interface so Scripts tab is always accessible
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

  // Open settings automatically if credentials are missing (only on non-custom branch)
  const settingsSection = document.querySelector('.settings-group details')
  if ((!data.auth_token || !data.license) && currentBranch !== 'custom') {
    settingsSection.open = true
  } else {
    settingsSection.open = false
  }

  // Show current version
  const manifest = chrome.runtime.getManifest()
  currentVersionSpan.textContent = manifest.version

  // Fetch API data if token exists, else use cached data if available
  if (data.auth_token) {
    fetchApiData()
  } else if (data.api_data) {
    // Fallback to cached data if offline/no token
    apiData = data.api_data
    renderFilters()
    updateList()
  } else {
    // No token and no cached data: show message in installer list
    updateListNoToken()
  }

  // Check for updates from GitHub
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
      console.log(`[Web DiceBot] New version available: ${latestVersion}`)
    }
  } catch (err) {
    console.error('[Web DiceBot] Check update failed:', err)
  }
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
      showInterface()
      renderFilters()
      updateList()
    }

    // Also fetch custom scripts from cloud
    fetchCustomScripts(token)
  } catch (err) {
    console.error('[Web DiceBot] Fetch failed:', err)
  }
}

async function fetchCustomScripts(token) {
  if (!token) return

  try {
    const apiBase = wdbApiInput.value || 'https://bot.webdicebot.net'

    // 1. Kiểm tra xem có script local nào chưa được upload không
    const localScripts = customScripts.filter((s) => s.id && s.id.length < 15)
    if (localScripts.length > 0) {
      console.log('[Web DiceBot] Found local scripts to migrate:', localScripts.length)
      for (const script of localScripts) {
        await syncScriptToCloud(script.id)
      }
    }

    // 2. Sau khi đã đẩy hết lên (nếu có), mới lấy danh sách chuẩn từ Cloud về
    const resp = await fetch(`${apiBase}/scripts`, {
      headers: { authorization: `Bearer ${token}` }
    })

    if (resp.ok) {
      const res = await resp.json()
      if (res.success && Array.isArray(res.data)) {
        // Nếu trên Cloud có dữ liệu, hoặc nếu chúng ta muốn tin tưởng Cloud tuyệt đối
        // Ta map lại danh sách
        const cloudScripts = res.data.map((s) => ({
          id: s._id,
          name: s.name,
          content: s.content,
          language: s.language || 'lua'
        }))

        // Cập nhật lại customScripts và lưu local
        customScripts = cloudScripts
        await chrome.storage.local.set({ custom_scripts: customScripts })
        renderScripts()
      }
    }
  } catch (err) {
    console.error('[Web DiceBot] Fetch/Sync custom scripts failed:', err)
  }
}

function showInterface() {
  appInterface.classList.remove('hidden')
}

// Show a prompt to enter token when no API data is available
function updateListNoToken() {
  if (currentBranch === 'custom') return // Scripts tab doesn't need token
  installerSelect.innerHTML =
    '<option value="" disabled selected>⚠ Enter token in Settings to load scripts</option>'
  previewSection.classList.add('hidden')
  gameFilters.innerHTML = ''
}

function showToast(message, type = '') {
  notificationToast.textContent = message
  notificationToast.className = 'notification-toast' // Reset
  if (type) notificationToast.classList.add(type)
  notificationToast.classList.remove('hidden')

  // Auto hide after 4 seconds
  clearTimeout(window.toastTimer)
  window.toastTimer = setTimeout(() => {
    notificationToast.classList.add('hidden')
  }, 4000)
}

function showConfirm(title, message, onConfirm) {
  if (!confirmModal) return

  confirmTitle.textContent = title
  confirmMessage.textContent = message
  confirmModal.classList.remove('hidden')

  const handleYes = () => {
    onConfirm()
    closeConfirm()
  }

  const handleNo = () => {
    closeConfirm()
  }

  const closeConfirm = () => {
    confirmModal.classList.add('hidden')
    confirmYesBtn.removeEventListener('click', handleYes)
    confirmNoBtn.removeEventListener('click', handleNo)
  }

  confirmYesBtn.addEventListener('click', handleYes)
  confirmNoBtn.addEventListener('click', handleNo)

  // Close on backdrop click
  confirmModal.onclick = (e) => {
    if (e.target === confirmModal) closeConfirm()
  }
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
  console.log('[Web DiceBot] Updating list with', apiData.length, 'items')

  const filtered = apiData.filter(
    (item) =>
      item.branch === currentBranch && (currentGameType === 'all' || item.game === currentGameType)
  )

  installerSelect.innerHTML = '<option value="">Select installer</option>'

  if (filtered.length === 0) {
    const opt = document.createElement('option')
    opt.textContent = 'No scripts found'
    opt.disabled = true
    installerSelect.appendChild(opt)
  }

  filtered.forEach((item) => {
    const opt = document.createElement('option')
    opt.value = item.CASINO_GAME
    opt.textContent = item.option || item.CASINO_GAME || 'Unknown'
    installerSelect.appendChild(opt)
  })

  // Try auto-match by current tab domain
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) return
    try {
      const url = new URL(tabs[0].url)
      const domain = url.hostname
      console.log('[Web DiceBot] Auto-matching for domain:', domain)

      const match = filtered.find((item) => item.site && domain.includes(item.site))
      if (match) {
        console.log('[Web DiceBot] Auto-match found:', match.CASINO_GAME)
        installerSelect.value = match.CASINO_GAME
        showPreview(match)
      } else {
        console.log('[Web DiceBot] No auto-match for', domain)
        installerSelect.value = ''
        previewSection.classList.add('hidden')
      }
    } catch (e) {
      console.error('[Web DiceBot] URL parsing failed', e)
    }
  })
}

function showPreview(item) {
  if (!item) return

  const api = wdbApiInput.value || 'https://bot.webdicebot.net'
  const license = licenseInput.value || 'YOUR_LICENSE'
  const branch = item.branch || currentBranch || 'stable'

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
localStorage.setItem("license", "${license}");`

  scriptPreview.textContent = code

  if (item.tips) {
    scriptTips.innerHTML = `<div class="tips-content"><span class="tips-icon">💡</span> ${item.tips}</div>`
    scriptTips.classList.remove('hidden')
  } else {
    scriptTips.classList.add('hidden')
  }

  previewSection.classList.remove('hidden')
}

// Events
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
    if (officialView) officialView.classList.add('hidden')
    if (customScriptsView) customScriptsView.classList.remove('hidden')
    if (settingsGroup) settingsGroup.classList.add('hidden')
  } else {
    if (officialView) officialView.classList.remove('hidden')
    if (customScriptsView) customScriptsView.classList.add('hidden')
    if (settingsGroup) settingsGroup.classList.remove('hidden')
    // Only update list if we have data or a token; otherwise show no-token message
    if (apiData.length > 0) {
      updateList()
    } else {
      updateListNoToken()
    }
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

  // Check if Bot is already installed by looking for #wdbWrap
  const checkResult = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => !!document.getElementById('wdbWrap')
  })

  if (checkResult[0].result) {
    showToast('Please refresh page before install')
    return
  }

  // Search in apiData but match BOTH CASINO_GAME and the currentBranch
  const selectedItem = apiData.find(
    (i) => i.CASINO_GAME === selectedGame && i.branch === currentBranch
  )
  if (!selectedItem) return

  const api = wdbApiInput.value || 'https://bot.webdicebot.net'
  const license = licenseInput.value || ''
  const branch = selectedItem.branch || currentBranch || 'stable'

  // 1. Persist the selection for future page loads
  await chrome.storage.local.set({
    active_game: selectedGame,
    active_branch: branch,
    wdb_api: api,
    license: license
  })

  // 2. Execute immediately in the current tab without refresh
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN', // Inject directly into page context
    func: async (wdbApi, casinoGame, licenseKey, branchName) => {
      // Khai báo biến toàn cục để script bot có thể tìm thấy
      window.WDB_API = wdbApi
      window.CASINO_GAME = casinoGame
      window.localStorage.setItem('license', licenseKey)

      try {
        let installer = await fetch(`${wdbApi}/${branchName}/init`)
        installer = await installer.text()
        ;(0, eval)(installer)
      } catch (error) {
        alert('Failed to inject script: ' + error.message)
      }
    },
    args: [api, selectedGame, license.trim(), branch]
  })

  injectBtn.textContent = '🚀 Installed'
  setTimeout(() => (injectBtn.textContent = 'Install'), 2000)
})

// Listen for tab changes to update auto-match
chrome.tabs.onActivated.addListener(() => updateList())
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') updateList()
})

saveSettingsBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({
    wdb_api: wdbApiInput.value,
    license: licenseInput.value,
    auth_token: authTokenInput.value
  })

  // Fetch data immediately after saving new token
  fetchApiData()

  saveSettingsBtn.textContent = '✅ SAVED'
  setTimeout(() => (saveSettingsBtn.textContent = 'SAVE'), 2000)
})

// Refresh list if storage changes (e.g. from background script)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.custom_scripts) {
    customScripts = changes.custom_scripts.newValue || []
    renderScripts()
  }
})

// --- Scripts Manager Logic ---
const smAddBtn = document.getElementById('sm-add')
const smImportBtn = document.getElementById('sm-import')
const smExportBtn = document.getElementById('sm-export')
const smFileInput = document.getElementById('sm-file-input')
const smList = document.getElementById('sm-list')
const smEditor = document.getElementById('sm-editor')
const smName = document.getElementById('sm-name')
const smLanguage = document.getElementById('sm-language')
const smContent = document.getElementById('sm-content')
const smSaveBtn = document.getElementById('sm-save')
const smCancelBtn = document.getElementById('sm-cancel')

let customScripts = []
let editingScriptId = null

function renderScripts() {
  if (!smList) return
  smList.innerHTML = ''
  customScripts.forEach((script) => {
    const li = document.createElement('li')
    li.draggable = true
    li.dataset.id = script.id

    li.addEventListener('dragstart', () => li.classList.add('dragging'))
    li.addEventListener('dragend', () => li.classList.remove('dragging'))

    const nameSpan = document.createElement('span')
    nameSpan.className = 'sm-list-name'

    let prefix = ''
    if (script.language) {
      prefix += `[${script.language === 'javascript' ? 'JS' : 'LUA'}] `
    }

    nameSpan.textContent = prefix + script.name
    nameSpan.title = 'Click to put this script'
    nameSpan.addEventListener('click', () => runCustomScript(script))

    const actionsDiv = document.createElement('div')
    actionsDiv.className = 'sm-list-actions'

    const editBtn = document.createElement('button')
    editBtn.className = 'sm-list-btn'
    editBtn.textContent = 'Edit'
    editBtn.addEventListener('click', () => openEditor(script))

    const delBtn = document.createElement('button')
    delBtn.className = 'sm-list-btn'
    delBtn.textContent = 'Del'
    delBtn.addEventListener('click', () => {
      showConfirm(
        'Delete Script',
        `Are you sure you want to delete "${script.name}"? This action cannot be undone.`,
        () => {
          const scriptIdToDelete = script.id
          customScripts = customScripts.filter((s) => s.id !== script.id)
          saveScripts()
          showToast('Script deleted', 'success')

          // Sync delete to cloud
          const token = authTokenInput.value.trim()
          if (token && scriptIdToDelete.length > 15) {
            const apiBase = wdbApiInput.value || 'https://bot.webdicebot.net'
            fetch(`${apiBase}/scripts/${scriptIdToDelete}`, {
              method: 'DELETE',
              headers: { authorization: `Bearer ${token}` }
            }).catch((err) => console.error('[Web DiceBot] Cloud delete failed:', err))
          }
        }
      )
    })

    actionsDiv.appendChild(editBtn)
    actionsDiv.appendChild(delBtn)

    li.appendChild(nameSpan)
    li.appendChild(actionsDiv)
    smList.appendChild(li)
  })
}

function openEditor(script = null) {
  smEditor.classList.remove('hidden')
  if (script) {
    editingScriptId = script.id
    smName.value = script.name
    smLanguage.value = script.language || 'lua'
    smContent.value = script.content
  } else {
    editingScriptId = null
    smName.value = ''
    smLanguage.value = 'lua'
    smContent.value = ''
  }
}

function closeEditor() {
  smEditor.classList.add('hidden')
  editingScriptId = null
}

async function saveScripts() {
  await chrome.storage.local.set({ custom_scripts: customScripts })
  renderScripts()
}

if (smList) {
  smList.addEventListener('dragover', (e) => {
    e.preventDefault()
    const afterElement = getDragAfterElement(smList, e.clientY)
    const draggable = document.querySelector('.dragging')
    if (draggable) {
      if (afterElement == null) smList.appendChild(draggable)
      else smList.insertBefore(draggable, afterElement)
    }
  })

  smList.addEventListener('drop', (e) => {
    e.preventDefault()
    const newOrderIds = Array.from(smList.querySelectorAll('li')).map((li) => li.dataset.id)
    customScripts.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id))
    chrome.storage.local.set({ custom_scripts: customScripts })
  })
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('li:not(.dragging)')]
  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect()
      const offset = y - box.top - box.height / 2
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child }
      } else {
        return closest
      }
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element
}

if (smAddBtn) smAddBtn.addEventListener('click', () => openEditor())
if (smCancelBtn) smCancelBtn.addEventListener('click', closeEditor)

if (smSaveBtn) {
  smSaveBtn.addEventListener('click', () => {
    const name = smName.value.trim()
    const language = smLanguage.value
    const content = smContent.value.trim()
    if (!name || !content) {
      showToast('Name and content are required')
      return
    }

    if (editingScriptId) {
      const script = customScripts.find((s) => s.id === editingScriptId)
      if (script) {
        script.name = name
        script.language = language
        script.content = content
      }
    } else {
      customScripts.push({
        id: Date.now().toString(),
        name,
        language,
        content
      })
    }

    saveScripts()
    closeEditor()
    showToast('Script saved')

    // Proactively sync to cloud if token exists
    const token = authTokenInput.value.trim()
    if (token) {
      syncScriptToCloud(editingScriptId || customScripts[customScripts.length - 1].id)
    }
  })
}

async function syncScriptToCloud(scriptId) {
  const token = authTokenInput.value.trim()
  if (!token) return

  const script = customScripts.find((s) => s.id === scriptId)
  if (!script) return

  try {
    const apiBase = wdbApiInput.value || 'https://bot.webdicebot.net'
    const isNew = !scriptId.includes('-') && scriptId.length > 15 // Check if it's a MongoDB ID

    // This is a simplified sync. Ideally, we distinguish between NEW and EDIT.
    // For now, if we saved it locally, we try to push it to cloud.
    // If it's a local-only ID (like Date.now()), it's NEW.
    const isLocalId = script.id.length < 15

    const method = isLocalId ? 'POST' : 'PUT'
    const url = isLocalId ? `${apiBase}/scripts` : `${apiBase}/scripts/${script.id}`

    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: script.name,
        content: script.content,
        language: script.language
      })
    })

    if (resp.ok) {
      const res = await resp.json()
      if (res.success && isLocalId) {
        // Update local ID with MongoDB ID from cloud
        script.id = res.data._id
        await saveScripts()
      }
    }
  } catch (err) {
    console.error('[Web DiceBot] Sync to cloud failed:', err)
  }
}

if (smExportBtn) {
  smExportBtn.addEventListener('click', () => {
    if (customScripts.length === 0) {
      showToast('No scripts to export')
      return
    }
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(customScripts, null, 2))
    const dlAnchorElem = document.createElement('a')
    dlAnchorElem.setAttribute('href', dataStr)
    dlAnchorElem.setAttribute('download', 'webdicebot_scripts.json')
    dlAnchorElem.click()
  })
}

if (smImportBtn) smImportBtn.addEventListener('click', () => smFileInput.click())

if (smFileInput) {
  smFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result)
        if (Array.isArray(imported)) {
          let importedCount = 0
          imported.forEach((imp) => {
            if (imp.id && imp.name && imp.content) {
              if (!customScripts.find((s) => s.id === imp.id)) {
                customScripts.push(imp)
                importedCount++
              }
            }
          })
          saveScripts()
          showToast(`Imported ${importedCount} scripts`)
        }
      } catch (err) {
        showToast('Invalid JSON file')
      }
    }
    reader.readAsText(file)
    smFileInput.value = ''
  })
}

async function runCustomScript(script) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab) return

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: (content) => {
      try {
        if (window.mode === 'lua') {
          if (window.luaEditor) {
            window.luaEditor.setValue(content)
          } else {
            alert('Script box not found on the page.')
          }
        } else if (window.mode === 'js') {
          if (window.jsEditor) {
            window.jsEditor.setValue(content)
          } else {
            alert('Script box not found on the page.')
          }
        } else {
          alert('Web DiceBot is not running on this page.')
        }
      } catch (e) {
        alert('Failed to load script into editor: ' + e.message)
      }
    },
    args: [script.content]
  })
  showToast(`🚀 ${script.name}`)
}
