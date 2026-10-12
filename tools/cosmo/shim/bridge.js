// Cosmo web bridge: the browser stand-in for Hermes Desktop's Electron preload.
//
// The official renderer (apps/desktop/src in hermes-agent) reaches the machine
// only through `window.hermesDesktop`. This file provides that object for a
// plain browser tab. The page is served by the Cosmo gate, which proxies
// /api/* to the Hermes backend and attaches the backend credential itself, so
// nothing here ever holds a real token.
//
// Three kinds of members:
//   - backed by the gate/backend (api, connection, files, clipboard, ...);
//   - backed by a browser equivalent (notifications, new tabs, zoom);
//   - deliberately absent. The renderer feature-detects most native surfaces
//     with `window.hermesDesktop?.x?.()`, so leaving HUD, tray, global hotkeys
//     and friends undefined is what hides them.
(() => {
  'use strict'

  const origin = location.origin
  // Placeholder credential. The gate replaces it on every proxied request and
  // WebSocket upgrade after it has checked the endmin session cookie.
  const TOKEN = 'cosmo'
  const PREFS = 'cosmo.bridge.'
  const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws?token=${TOKEN}`

  const pref = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(PREFS + key)

        return raw === null ? fallback : JSON.parse(raw)
      } catch {
        return fallback
      }
    },
    set(key, value) {
      try {
        if (value === null || value === undefined) {
          localStorage.removeItem(PREFS + key)
        } else {
          localStorage.setItem(PREFS + key, JSON.stringify(value))
        }
      } catch {
        // Storage is a convenience here; the bridge works without it.
      }
    }
  }

  // Tiny event hub for the `on*` subscriptions the bridge can actually fire.
  const listeners = new Map()

  const on = channel => callback => {
    if (!listeners.has(channel)) {
      listeners.set(channel, new Set())
    }

    listeners.get(channel).add(callback)

    return () => listeners.get(channel)?.delete(callback)
  }

  const emit = (channel, payload) => {
    for (const callback of listeners.get(channel) ?? []) {
      try {
        callback(payload)
      } catch (error) {
        console.error(`[cosmo] ${channel} listener failed`, error)
      }
    }
  }

  const never = () => () => {}
  const unsupported = what => Promise.reject(new Error(`${what} is not available in the web version of Cosmo.`))

  // ── Backend REST ─────────────────────────────────────────────────────────
  // Mirrors electron/main.ts fetchJson: same error wording (`<status>: <body>`)
  // because the renderer classifies failures by that prefix.
  function scopedPath(path, profile) {
    const scope = String(profile ?? '').trim()

    if (!scope || /[?&]profile=/.test(path)) {
      return path
    }

    return `${path}${path.includes('?') ? '&' : '?'}profile=${encodeURIComponent(scope)}`
  }

  async function api(request) {
    const path = scopedPath(String(request?.path || ''), request?.profile)
    const method = String(request?.method || 'GET').toUpperCase()
    const timeoutMs = Number(request?.timeoutMs) > 0 ? Number(request.timeoutMs) : 15000
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const init = { method, credentials: 'same-origin', signal: controller.signal, headers: {} }

    if (request?.upload) {
      const form = new FormData()
      const { filename, contentType, bytes } = request.upload

      form.append('file', new Blob([bytes], { type: contentType || 'application/octet-stream' }), filename || 'file')
      init.body = form
    } else if (request?.body !== undefined) {
      init.headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(request.body)
    }

    let response

    try {
      response = await fetch(path, init)
    } catch (error) {
      throw new Error(
        controller.signal.aborted
          ? `Timed out connecting to Hermes backend after ${timeoutMs}ms`
          : `Could not reach Hermes backend: ${error?.message || error}`
      )
    } finally {
      clearTimeout(timer)
    }

    const text = await response.text()

    if (response.status === 401 && response.headers.get('X-Cosmo-Auth') === 'required') {
      // The endmin session ended (signed out, role changed, expired). A reload
      // sends the tab back through the sign-in redirect.
      emit('auth-lost')
    }

    if (!response.ok) {
      const error = new Error(`${response.status}: ${text || response.statusText}`)

      error.statusCode = response.status
      throw error
    }

    if (!text) {
      return null
    }

    if (/^\s*<(?:!doctype|html)/i.test(text) || (response.headers.get('content-type') || '').includes('text/html')) {
      throw new Error(
        `Expected JSON from ${path} but got HTML (status ${response.status}). The endpoint is likely missing on the Hermes backend.`
      )
    }

    try {
      return JSON.parse(text)
    } catch {
      throw new Error(`Invalid JSON from ${path} (status ${response.status}): ${text.slice(0, 200)}`)
    }
  }

  on('auth-lost')(() => {
    if (!sessionStorage.getItem('cosmo.reauth')) {
      sessionStorage.setItem('cosmo.reauth', String(Date.now()))
      location.reload()
    }
  })
  window.addEventListener('load', () => setTimeout(() => sessionStorage.removeItem('cosmo.reauth'), 15000))

  // ── Connection ───────────────────────────────────────────────────────────
  // One backend, reached through this origin. `remote` makes the renderer use
  // the backend's own REST surface for files, git and media instead of asking
  // the (absent) native shell.
  function connection(profile, registryScoped = false) {
    const scope = String(profile ?? '').trim()

    return {
      baseUrl: origin,
      wsUrl,
      token: TOKEN,
      mode: 'remote',
      authMode: 'token',
      remoteKind: 'url',
      remoteHost: location.host,
      source: 'settings',
      // The one registry entry (see registry() below) is this same backend.
      connectionId: 'cosmo',
      ...(registryScoped ? { registryScoped: true } : {}),
      customWindowControls: false,
      isFullscreen: Boolean(document.fullscreenElement),
      isMaximized: false,
      nativeOverlayWidth: 0,
      windowButtonPosition: null,
      logs: [],
      ...(scope && scope !== 'default' ? { profile: scope, sharedPrimary: true } : {})
    }
  }

  const connectionConfig = profile => ({
    envOverride: true,
    mode: 'remote',
    profile: profile ?? null,
    remoteAuthMode: 'token',
    remoteOauthConnected: false,
    remoteTokenPreview: null,
    remoteTokenSet: true,
    secureTokenStorage: true,
    remoteTokenPlainText: false,
    remoteUrl: origin,
    cloudOrg: '',
    sshHost: '',
    sshUser: '',
    sshPort: null,
    sshKeyPath: '',
    sshRemoteHermesPath: '',
    sshRemoteProfile: ''
  })

  const registry = () => ({
    version: 2,
    primary: 'cosmo',
    launchMode: 'primary',
    lastUsed: 'cosmo',
    secureTokenStorage: true,
    connections: [
      { id: 'cosmo', kind: 'remote', label: 'Cosmo', url: origin, authMode: 'token', tokenSet: true, tokenPreview: null }
    ]
  })

  const bootProgress = () => ({
    error: null,
    fakeMode: false,
    message: '',
    phase: 'ready',
    progress: 1,
    running: true,
    timestamp: Date.now()
  })

  const bootstrapState = () => ({
    active: false,
    manifest: null,
    stages: {},
    error: null,
    log: [],
    startedAt: null,
    completedAt: null,
    setupChoice: null,
    unsupportedPlatform: null,
    bundled: false
  })

  // ── Files ────────────────────────────────────────────────────────────────
  // The renderer attaches files by path: Electron hands it a path on the local
  // disk, and for a remote backend the renderer later reads that path and
  // uploads the bytes. A browser tab has no paths, so files the person picks,
  // drops or pastes are kept in memory under a made-up path that plays the
  // same part. Any other path is a path on the Hermes host and is read there.
  const LOCAL_ROOT = '/cosmo-local'
  const LOCAL_LIMIT = 200
  const localFiles = new Map()
  const localPathOf = new WeakMap()
  const fsPath = (endpoint, filePath) => `/api/fs/${endpoint}?path=${encodeURIComponent(filePath)}`

  const readError = (error, path) => ({
    ok: false,
    error: 'read-failed',
    message: String(error?.message || error),
    ...(path ? { path } : {})
  })

  function keepLocal(blob, name) {
    const known = localPathOf.get(blob)

    if (known && localFiles.has(known)) {
      return known
    }

    const safeName = String(name || 'file').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(-120) || 'file'
    const path = `${LOCAL_ROOT}/${crypto.randomUUID().slice(0, 8)}/${safeName}`

    localFiles.set(path, blob)
    localPathOf.set(blob, path)

    // Oldest first out: a chip that old has long been sent or dismissed.
    while (localFiles.size > LOCAL_LIMIT) {
      localFiles.delete(localFiles.keys().next().value)
    }

    return path
  }

  const blobDataUrl = blob =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'))
      reader.readAsDataURL(blob)
    })

  async function readFileDataUrl(filePath) {
    if (/^(data|blob):/i.test(filePath)) {
      return filePath
    }

    try {
      const local = localFiles.get(filePath)

      if (local) {
        return await blobDataUrl(local)
      }

      const result = await api({ path: fsPath('read-data-url', filePath), timeoutMs: 60000 })

      return result?.dataUrl || readError('Gateway returned no file data', filePath)
    } catch (error) {
      return readError(error, filePath)
    }
  }

  async function readFileText(filePath) {
    try {
      const local = localFiles.get(filePath)

      if (local) {
        return { path: filePath, text: await local.text(), byteSize: local.size, mimeType: local.type || 'text/plain' }
      }

      return await api({ path: fsPath('read-text', filePath), timeoutMs: 60000 })
    } catch (error) {
      return readError(error, filePath)
    }
  }

  // The native "open file" dialog becomes the browser's. Folders are chosen on
  // the Hermes host with the renderer's own picker, never through here.
  function selectPaths(options) {
    if (options?.directories) {
      return Promise.resolve([])
    }

    return new Promise(resolve => {
      const input = document.createElement('input')
      const extensions = (options?.filters ?? []).flatMap(filter => filter.extensions ?? []).filter(ext => ext !== '*')

      input.type = 'file'
      input.multiple = options?.multiple !== false
      input.style.display = 'none'

      if (extensions.length) {
        input.accept = extensions.map(ext => `.${ext}`).join(',')
      }

      const finish = () => {
        resolve([...(input.files ?? [])].map(file => keepLocal(file, file.name)))
        input.remove()
      }

      input.addEventListener('change', finish, { once: true })
      input.addEventListener('cancel', finish, { once: true })
      document.body.appendChild(input)
      input.click()
    })
  }

  async function readDir(dirPath) {
    try {
      return await api({ path: fsPath('list', dirPath), timeoutMs: 30000 })
    } catch (error) {
      return { entries: [], error: String(error?.message || error) }
    }
  }

  async function saveImageBuffer(data, ext, name) {
    const extension = String(ext || 'png').replace(/^\./, '')
    const type = `image/${extension === 'jpg' ? 'jpeg' : extension}`

    return keepLocal(new Blob([data], { type }), name || `image-${Date.now()}.${extension}`)
  }

  async function savePastedText(text) {
    return keepLocal(new Blob([String(text ?? '')], { type: 'text/plain' }), `pasted-${Date.now()}.txt`)
  }

  async function saveClipboardImage() {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find(candidate => candidate.startsWith('image/'))

        if (type) {
          return keepLocal(await item.getType(type), `clipboard-${Date.now()}.${type.split('/')[1] || 'png'}`)
        }
      }
    } catch {
      // No permission or no image: same result as an empty clipboard.
    }

    return ''
  }

  function download(url, filename) {
    const link = document.createElement('a')

    link.href = url

    if (filename) {
      link.download = filename
    }

    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  async function saveGatewayFile(payload) {
    const path = String(payload?.path || '')

    if (!path) {
      return { saved: false }
    }

    download(`/api/fs/download?path=${encodeURIComponent(path)}`, payload?.suggestedName || path.split(/[\\/]/).pop())

    return { saved: true, path }
  }

  async function saveImageFromUrl(url) {
    try {
      download(url, String(url).split(/[/?#]/).filter(Boolean).pop() || 'image')

      return true
    } catch {
      return false
    }
  }

  // ── Browser equivalents ──────────────────────────────────────────────────
  function openExternal(url) {
    const target = String(url || '')

    if (/^(https?:|mailto:)/i.test(target)) {
      window.open(target, '_blank', 'noopener,noreferrer')
    }

    return Promise.resolve()
  }

  function openTab(search, route) {
    window.open(`${location.pathname}${search}#${route}`, '_blank')

    return Promise.resolve({ ok: true })
  }

  async function notify(payload) {
    if (!('Notification' in window)) {
      return false
    }

    if (Notification.permission === 'default') {
      await Notification.requestPermission().catch(() => 'denied')
    }

    if (Notification.permission !== 'granted') {
      return false
    }

    const notification = new Notification(payload?.title || 'Cosmo', { body: payload?.body || '', tag: payload?.tag })

    notification.onclick = () => {
      window.focus()

      if (payload?.sessionId) {
        emit('focus-session', payload.sessionId)
      }
    }

    return true
  }

  async function requestMicrophoneAccess() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      stream.getTracks().forEach(track => track.stop())

      return true
    } catch {
      return false
    }
  }

  // Sessions opened in other tabs coordinate through BroadcastChannel, the web
  // counterpart of the main-process relay between Electron windows.
  const relay = 'BroadcastChannel' in window ? new BroadcastChannel('cosmo.relay') : null
  const claimed = new Set()

  relay?.addEventListener('message', event => {
    if (event.data?.kind === 'relay') {
      emit('relay', event.data.payload)
    } else if (event.data?.kind === 'claim') {
      claimed.add(event.data.key)
    }
  })

  async function claimAmbientCue(key) {
    if (claimed.has(key)) {
      return false
    }

    claimed.add(key)
    relay?.postMessage({ kind: 'claim', key })
    // Let a peer that claimed in the same instant be heard; the visible tab wins.
    await new Promise(resolve => setTimeout(resolve, 30))

    return document.visibilityState === 'visible' || !relay
  }

  document.addEventListener('fullscreenchange', () =>
    emit('window-state', {
      isFullscreen: Boolean(document.fullscreenElement),
      isMaximized: false,
      isVisible: document.visibilityState === 'visible',
      nativeOverlayWidth: 0,
      windowButtonPosition: null
    })
  )

  const version = async () => {
    let backend = ''

    try {
      backend = (await api({ path: '/api/status' }))?.version || ''
    } catch {
      // Version is display-only.
    }

    return {
      appVersion: backend || 'web',
      channel: null,
      electronVersion: '',
      nodeVersion: '',
      platform: 'web',
      hermesRoot: '',
      source: 'unknown',
      updateMechanism: 'external',
      payload: 'light',
      hermesRuntime: { type: 'light' },
      bundleOutOfSync: false,
      bundleSwapPending: false
    }
  }

  const bridge = {
    glassSupported: false,
    translucencySupported: false,
    localModelsEnabled: false,
    guestOnboardingEnabled: false,
    localSkin: null,

    // Connection
    getConnection: async profile => connection(profile),
    getConnectionFor: async payload => connection(payload?.profile, true),
    getGatewayWsUrl: async () => ({ ok: true, wsUrl }),
    getGatewayWsUrlFor: async () => ({ ok: true, wsUrl }),
    getProfileRoutes: async profiles =>
      (profiles?.length ? profiles : ['default']).map(profile => ({
        connectionId: 'cosmo',
        mode: 'remote',
        primary: true,
        profile,
        targetProfile: profile
      })),
    revalidateConnection: async () => ({ ok: true, rebuilt: false }),
    touchBackend: async () => ({ ok: true }),
    getPoolLimits: async () => ({ maxBackends: 1, idleMs: 0 }),
    setPoolLimits: async () => ({ ok: true, limits: { maxBackends: 1, idleMs: 0 } }),
    getBootProgress: async () => bootProgress(),
    onBootProgress: never,
    getBootstrapState: async () => bootstrapState(),
    onBootstrapEvent: never,
    continueBootstrapLocal: async () => ({ ok: true }),
    resetBootstrap: async () => ({ ok: true }),
    repairBootstrap: async () => ({ ok: true }),
    cancelBootstrap: async () => ({ ok: true, cancelled: false }),
    updateHold: {
      recheck: async () => ({ ok: true }),
      quit: async () => ({ ok: true }),
      startAnyway: async () => ({ ok: true })
    },
    onBackendExit: never,
    setActiveConnectionRoute: () => {},

    // The connection is fixed by where the page is served from, so the
    // registry is read-only: one entry, and edits are refused.
    getConnectionConfig: async profile => connectionConfig(profile),
    saveConnectionConfig: async payload => connectionConfig(payload?.profile),
    applyConnectionConfig: async payload => connectionConfig(payload?.profile),
    testConnectionConfig: async () => ({ ok: true, reachable: true, baseUrl: origin }),
    getSecretStorageEncryption: async () => ({ on: false }),
    setSecretStorageEncryption: async () => ({ on: false }),
    connections: {
      list: async () => registry(),
      save: () => unsupported('Adding gateways'),
      remove: () => unsupported('Removing gateways'),
      setPrimary: async () => ({ ok: true, registry: registry() }),
      setLaunchMode: async () => ({ ok: true, registry: registry() }),
      setLastUsed: async () => ({ ok: true, registry: registry() }),
      test: async () => ({ ok: true, reachable: true, baseUrl: origin })
    },
    sshConfigHosts: async () => ({ hosts: [] }),
    sshResolveHost: async () => ({ hostname: null, identityFile: null, port: null, user: null }),
    probeConnectionConfig: async remoteUrl => ({
      baseUrl: remoteUrl,
      reachable: false,
      authMode: 'unknown',
      providers: [],
      version: null,
      error: 'The web version of Cosmo connects only to its own gateway.'
    }),
    oauthLoginConnectionConfig: async remoteUrl => ({ ok: false, baseUrl: remoteUrl, connected: false }),
    oauthLogoutConnectionConfig: async () => ({ ok: true, connected: false }),
    cloud: {
      status: async () => ({ portalBaseUrl: '', signedIn: false }),
      login: async () => ({ ok: false, portalBaseUrl: '', signedIn: false }),
      logout: async () => ({ ok: true, portalBaseUrl: '', signedIn: false }),
      discover: async () => ({ agents: [] }),
      agentSignIn: async dashboardUrl => ({ baseUrl: dashboardUrl, connected: false })
    },
    profile: {
      getDefault: async () => pref.get('profile.default', null),
      setDefault: async route => {
        pref.set('profile.default', route)
        emit('profile-default', route)

        return route
      },
      onDefaultChanged: on('profile-default'),
      get: async () => ({ profile: pref.get('profile.active', null) }),
      remember: async name => {
        pref.set('profile.active', name || null)

        return { profile: name || null }
      },
      set: async name => {
        pref.set('profile.active', name || null)
        setTimeout(() => location.reload(), 0)

        return { profile: name || null }
      }
    },

    api,

    // Windows → browser tabs
    openSessionWindow: (sessionId, opts) =>
      openTab(
        `?win=secondary${opts?.watch ? '&watch=1' : ''}${opts?.profile ? `&profile=${encodeURIComponent(opts.profile)}` : ''}`,
        `/${encodeURIComponent(sessionId)}`
      ),
    openWindow: options =>
      openTab(options?.profile ? `?profile=${encodeURIComponent(options.profile)}` : '', '/'),
    openSessionInTerminal: async () => ({ ok: false, error: 'unsupported' }),
    openBrowserWindow: async () => ({ ok: false, error: 'unsupported' }),
    onBrowserPopoutClosed: never,
    windowRelay: {
      send: payload => relay?.postMessage({ kind: 'relay', payload }),
      onMessage: on('relay')
    },
    claimAmbientCue,
    windowControls: { custom: false, minimize: () => {}, toggleMaximize: () => {}, close: () => window.close() },
    onWindowStateChanged: on('window-state'),
    onFocusSession: on('focus-session'),
    petOverlay: {
      open: async () => ({ ok: false }),
      close: async () => ({ ok: true }),
      setBounds: () => {},
      setIgnoreMouse: () => {},
      setFocusable: () => {},
      pushState: () => {},
      control: () => {},
      onState: never,
      onControl: never
    },

    // Notifications, media, clipboard
    notify,
    requestMicrophoneAccess,
    writeClipboard: async text => {
      try {
        await navigator.clipboard.writeText(String(text ?? ''))

        return true
      } catch {
        return false
      }
    },
    readClipboard: async () => {
      try {
        return await navigator.clipboard.readText()
      } catch {
        return ''
      }
    },

    // Files
    readFileDataUrl,
    readFileDataUrlForAttach: readFileDataUrl,
    readFileText,
    readPluginSource: readFileText,
    readDir,
    gitRoot: async startPath => {
      try {
        return (await api({ path: fsPath('git-root', startPath) }))?.root ?? null
      } catch {
        return null
      }
    },
    selectPaths,
    saveGatewayFile,
    saveImageFromUrl,
    saveImageBuffer,
    savePastedText,
    saveClipboardImage,
    getPathForFile: file => (file instanceof Blob ? keepLocal(file, file.name) : ''),
    normalizePreviewTarget: async target => {
      const value = String(target || '').trim()

      return /^https?:\/\//i.test(value) ? { kind: 'url', label: value, url: value } : null
    },
    watchPreviewFile: async () => readError('File watching is not available in the web version of Cosmo.'),
    stopPreviewFileWatch: async () => true,
    onPreviewFileChanged: never,
    sanitizeWorkspaceCwd: async cwd => ({ cwd: String(cwd ?? ''), sanitized: false }),
    settings: {
      getDefaultProjectDir: async () => {
        const dir = pref.get('projectDir', null)

        return { defaultLabel: '', dir, resolvedCwd: dir || '' }
      },
      pickDefaultProjectDir: async () => ({ canceled: true, dir: null }),
      setDefaultProjectDir: async dir => {
        pref.set('projectDir', dir || null)

        return { dir: dir || null }
      }
    },

    // Links
    openExternal,
    openPreviewInBrowser: openExternal,
    fetchLinkTitle: async () => '',

    // Logs: the shell's own log is the browser console here.
    revealLogs: async () => ({ ok: false, path: '', error: 'Open the browser console to read the page log.' }),
    getRecentLogs: async () => ({ path: '', lines: [] }),
    reportRendererError: report => console.error('[cosmo] renderer error', report),
    logLine: line => console.info('[cosmo]', line),

    // Terminal: Desktop's terminal pane is a shell on the machine the app runs
    // on. A tab has no such machine, so the member stays absent and the
    // renderer shows the pane as closed.
    terminal: undefined,

    // Versions and updates: the page is whatever the gate serves.
    getVersion: version,
    getSyncStatus: async () => null,
    updates: {
      check: async () => ({ supported: false, updateAvailable: false, reason: 'web' }),
      apply: async () => ({ ok: false, manual: true, message: 'Cosmo is updated on the server.' }),
      onProgress: never
    },
    uninstall: {
      summary: () => unsupported('Uninstalling'),
      run: async () => ({ ok: false, error: 'unsupported' }),
      openAppsSettings: async () => {}
    },
    themes: {
      fetchMarketplace: () => unsupported('Importing VS Code themes'),
      searchMarketplace: async () => []
    },

    // Find in page: the browser's own Ctrl/Cmd+F does this.
    findInPage: async () => ({ count: 0 }),
    stopFindInPage: async () => {},
    onFoundInPage: never,
    onOpenFindBarRequested: never,

    quickEntry: undefined
  }

  // Report reads of members this bridge does not provide, once each, so a gap
  // shows up in the console as a name instead of as a blank feature.
  const reported = new Set()

  window.hermesDesktop = new Proxy(bridge, {
    get(target, key) {
      if (typeof key === 'string' && !(key in target) && !reported.has(key)) {
        reported.add(key)
        console.debug(`[cosmo] bridge member not provided: ${key}`)
      }

      return target[key]
    }
  })
})()
