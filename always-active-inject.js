;(function () {
  const log = (...args) => console.log('[Always Active]', ...args)

  // Override visibilityState and hidden properties
  Object.defineProperty(document, 'visibilityState', {
    get: () => 'visible',
    configurable: true
  })

  Object.defineProperty(document, 'hidden', {
    get: () => false,
    configurable: true
  })

  // Block visibilitychange events
  const block = (e) => {
    e.stopImmediatePropagation()
  }

  window.addEventListener('visibilitychange', block, true)
  window.addEventListener('webkitvisibilitychange', block, true)
  window.addEventListener('mozvisibilitychange', block, true)
  window.addEventListener('msvisibilitychange', block, true)

  // Optional: Block blur/focus if needed, but some sites need these for input.
  // However, most "always active" scripts block them.
  window.addEventListener('blur', block, true)
  window.addEventListener('focus', block, true)

  // Keep requestAnimationFrame running if possible
  const nativeRequestAnimationFrame = window.requestAnimationFrame
  window.requestAnimationFrame = (callback) => {
    return nativeRequestAnimationFrame(() => {
      callback(performance.now())
    })
  }

  log('Active for', window.location.hostname)
})()
