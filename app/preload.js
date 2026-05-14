const { contextBridge, ipcRenderer } = require('electron');

let isRegisteredCustomLanguageRegistration = false

contextBridge.exposeInMainWorld('electron', {
    readDirTree: (rootPath, options = {}) => ipcRenderer.invoke('readDirTree', rootPath, options),
    readFileContent: (filePath, encoding = 'utf8') => ipcRenderer.invoke('readFileContent', filePath, encoding),
    getUserPcInfo: () => ipcRenderer.invoke("getUserPcInfo"),
    getPackageData: () => ipcRenderer.invoke("getPackageData"),
    getLocalBugsData: () => ipcRenderer.invoke("getLocalBugsData"),
    updateCalendarData: (data) => ipcRenderer.invoke("updateCalendarData", data),
    saveFile: (path, content) => ipcRenderer.invoke("saveFile", path, content),

    askToSaveNewFile: (name, content) => ipcRenderer.invoke("ask-to-save-content", name, content),

    modifyLocalBugs: (type, data) => ipcRenderer.invoke("modify-local-bugs", type, data),

    keyboardAction: (callback) => ipcRenderer.on("keyboard_action", (_, data) => callback(data)),

    getCurrentUserDataFromAPI: () => ipcRenderer.invoke("get-user-data-from-api"),
    getOrgDataFromAPI: (orgid) => ipcRenderer.invoke("getOrgDataFromAPI", orgid),

    close: () => ipcRenderer.send("close"),
    minimize: () => ipcRenderer.send("minimize"),
    maximize: () => ipcRenderer.send("fullscreen"),
    getAllIcons: () => ipcRenderer.invoke("getAllIcons"),

    login: (username, password) => ipcRenderer.invoke("login", username, password),
    register: (username, password, passwordConfirm) => ipcRenderer.invoke("register", username, password, passwordConfirm),
    isLoggedIn: () => ipcRenderer.invoke("is-logged-in"),
    logout: () => ipcRenderer.invoke("logout"),

    updateLocalAppData: (data) => ipcRenderer.send("updateLocalAppData", data),
    reload: () => ipcRenderer.send("reload"),
    goOffline: () => ipcRenderer.send("goOffline"),

    openInBrowser: (url) => ipcRenderer.invoke("open-in-browser", url),
    revealInFileExplorer: (path) => ipcRenderer.invoke("reveal-in-file-explorer", path),
    createFile: (path) => ipcRenderer.invoke("create-file", path),
    createFolder: (path) => ipcRenderer.invoke("create-folder", path),
    renamePath: (oldPath, newPath) => ipcRenderer.invoke("rename-path", oldPath, newPath),
    getAppIcons: () => ipcRenderer.invoke("get-app-icons"),
    getAppIcon: () => ipcRenderer.invoke("get-app-icon"),

    getLocal: () => ipcRenderer.invoke("get-app-local"),

    requestFile: () => ipcRenderer.invoke("request-file-open"),
    requestFolder: () => ipcRenderer.invoke("request-folder-open"),

    setSettings: (data) => ipcRenderer.invoke("set-settings", data),
    readSettings: () => ipcRenderer.invoke("read-settings"),

    runPython: ({ code, filePath, useEmbed }) => ipcRenderer.invoke("run-python-code", { code, filePath, useEmbed }),

    startLiveServer: (htmlPath) => ipcRenderer.invoke("start-live-server", htmlPath),
    stopLiveServer: () => ipcRenderer.invoke("stop-live-server"),

    onStatusUpdate: (callback) => ipcRenderer.on("status-update", callback),

    sendCommand: (data) => ipcRenderer.send("terminal-command", data),
    sendInput: (input) => ipcRenderer.send("terminal-input", input),
    killProcess: () => ipcRenderer.send("terminal-kill"),
    cleanupTerminal: () => ipcRenderer.send("terminal-cleanup"),
    onCommandResult: (callback) => {
        const listener = (event, result) => callback(result)
        ipcRenderer.on("terminal-result", listener)
        return () => ipcRenderer.removeListener("terminal-result", listener)
    },

    requestExtensions: () => ipcRenderer.invoke("request-extensions"),
    requestExtension: (name) => ipcRenderer.invoke("request-extension", name),
    createDebuggerWindow: () => ipcRenderer.invoke("create-debugger-window"),
    loadExtensionModule: (name, version) => ipcRenderer.invoke("load-module", name, version),

    readFile: (path) => ipcRenderer.invoke("read-file", path),

    removeByPath: (path) => ipcRenderer.invoke("remove-by-path", path),

    sendDebuggerData: (data) => ipcRenderer.send("debugger-data", data),
    onDebuggerReady: () => {
        return new Promise((resolve) => {
            const handler = (_, ...args) => {
                resolve(...args)
                ipcRenderer.removeListener("debugger-ready", handler)
            }

            ipcRenderer.on("debugger-ready", handler)
        })
    },
    mainReady: () => ipcRenderer.send("main-ready"),

    getPython: () => ipcRenderer.invoke("get-python-info"),
    getDirname: () => ipcRenderer.invoke("get-dirname"),
    getPlatform: () => ipcRenderer.invoke("get-platform"),

    // for extensions

    runExtension: (code, permissions, meta) => ipcRenderer.invoke("run-extension", code, permissions, meta),
    onThemeRegister: (callback) => ipcRenderer.on("new-theme-register", (event, name, data) => callback(name, data)),
    onLanguageRegister: (callback) => ipcRenderer.on("new-language-register", (event, data) => callback(data)),
    onLoadCSS: (callback) => ipcRenderer.on("load-css", (event, name, content) => callback(name, content)),
    onNewLanguageIconsRegister: (callback) => ipcRenderer.on("new-language-icons-register", (event, data) => callback(data)),
    onNewDirIconRegister: (callback) => ipcRenderer.on("new-dir-icon-register", (event, data) => callback(data)),
    onNewDocumentationTypesRegister: (callback) => ipcRenderer.on("new-documentation-types-register", (event, data) => callback(data)),
    onExtLog: (callback) => ipcRenderer.on("extension-log", (event, data) => callback(data)),

    onEditorChangeNewHLRules: (callback) => ipcRenderer.on("on-editor-change-new-hl-rules", (event, data) => callback(data)),

    onCustomLanguageRegistration: () => {
        return new Promise((resolve) => {
            if (isRegisteredCustomLanguageRegistration) {
                resolve()
                return
            }

            ipcRenderer.once("custom-language-registered", () => {
                isRegisteredCustomLanguageRegistration = true
                resolve()
            })
        })
    },

    sendCustomLanguageRegistrationReady: () => {
        ipcRenderer.send("custom-language-registration-ready")
    },

    triggerFileOpenedEvent: (data) => ipcRenderer.send("file-opened-event", data),
    triggerAceChangedEvent: (data) => ipcRenderer.send("ace-changed-event", data),

    // 

    onAuthMsg: (callback) => ipcRenderer.on("auth-msg", (event, data) => callback(data)),
    sendAuthMsg: (data) => ipcRenderer.send("auth-msg", data),
    
    on: (event, msg) => ipcRenderer.on(event, msg),
    oncb: (event, cb) => ipcRenderer.on(event, (_, data) => cb(data)),
});
