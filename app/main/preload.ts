import { RunPythonPayload, SaveContentPayload } from "./payloads";

const { contextBridge, ipcRenderer } = require('electron');

let isRegisteredCustomLanguageRegistration = false;

contextBridge.exposeInMainWorld('electron', {
    readDirTree: (rootPath: any, options = {}) => ipcRenderer.invoke('readDirTree', rootPath, options),
    readFileContent: (filePath: any, encoding = 'utf8') => ipcRenderer.invoke('readFileContent', filePath, encoding),
    getUserPcInfo: () => ipcRenderer.invoke("get-user-pc-info"),
    getPackageData: () => ipcRenderer.invoke("get-package-data"),
    getLocalBugsData: () => ipcRenderer.invoke("get-local-bugs-data"),
    getAppIcons: () => ipcRenderer.invoke("get-app-icons"),
    getAppIcon: () => ipcRenderer.invoke("get-app-icon"),
    getAllLanguages: () => ipcRenderer.invoke("get-all-languages"),
    getAllLanguagesJSON: () => ipcRenderer.invoke("get-all-languages-json"),
    getUserToken: () => ipcRenderer.invoke("get-user-token"),
    getUsedLanguagesByPath: (path: any) => ipcRenderer.invoke("get-used-languages-by-path", path),
    getExtensionsDir: () => ipcRenderer.invoke("get-extensions-dir"),

    requestAddBug: (params: any) => ipcRenderer.invoke("request-add-bug", params),
    requestMakeVerifyBug: (params: any) => ipcRenderer.invoke("request-make-verify-bug", params),
    requestGetYourOrgColleagues: () => ipcRenderer.invoke("request-get-your-org-colleagues"),
    createOrganization: (params: any) => ipcRenderer.invoke("create-organization", params),
    requestExploreOrganizations: () => ipcRenderer.invoke("get-explore-organizations"),
    requestRecoveryCode: (email: string) => ipcRenderer.invoke("request-recovery-code", email),
    verifyRecoveryCode: (email: string, code: string) => ipcRenderer.invoke("verify-recovery-code", email, code),
    resetPassword: (recoveryToken: string, newPassword: string) => ipcRenderer.invoke("reset-password", recoveryToken, newPassword),

    createNotification: (data: any) => ipcRenderer.send("spawn-notification", data),

    saveFile: (path: string, content: string) => ipcRenderer.invoke("save-file", path, content),

    setNonAccountMode: (value: boolean) => ipcRenderer.invoke("set-non-account-mode", value),

    askToSaveNewFile: (properties: SaveContentPayload) => ipcRenderer.invoke("ask-to-save-content", properties),

    keyboardAction: (callback: any) => ipcRenderer.on("keyboard_action", (_: any, data: any) => callback(data)),

    getCurrentUserDataFromAPI: () => ipcRenderer.invoke("get-user-data-from-api"),
    getOrgDataFromAPI: (orgid: number) => ipcRenderer.invoke("get-org-data-from-api", orgid),
    removeOrg: (orgid: number) => ipcRenderer.invoke("remove-org", orgid),
    joinOrg: (inviteCode: string) => ipcRenderer.invoke("join-org", inviteCode),

    close: () => ipcRenderer.send("close"),
    minimize: () => ipcRenderer.send("minimize"),
    maximize: () => ipcRenderer.send("fullscreen"),
    getAllIcons: () => ipcRenderer.invoke("get-all-app-icons"),
    getAllFilenamesIcons: () => ipcRenderer.invoke("get-all-filenames-app-icons"),

    login: (email: string, password: string) => ipcRenderer.invoke("login", email, password),
    register: (username: string, email: string, password: string, passwordConfirm: string) => ipcRenderer.invoke("register", username, email, password, passwordConfirm),
    isLoggedIn: () => ipcRenderer.invoke("is-logged-in"),
    logout: () => ipcRenderer.invoke("logout"),

    updateLocalAppData: (data: any) => ipcRenderer.send("update-local-app-data", data),
    reload: () => ipcRenderer.send("reload"),
    goOffline: () => ipcRenderer.send("goOffline"),

    openInBrowser: (url: string) => ipcRenderer.invoke("open-in-browser", url),
    revealInFileExplorer: (path: string) => ipcRenderer.invoke("reveal-in-file-explorer", path),
    createFile: (path: string) => ipcRenderer.invoke("create-file", path),
    createFolder: (path: string) => ipcRenderer.invoke("create-folder", path),
    renamePath: (oldPath: string, newPath: string) => ipcRenderer.invoke("rename-path", oldPath, newPath),

    getLocal: () => ipcRenderer.invoke("get-app-local"),

    requestFile: () => ipcRenderer.invoke("request-file-open"),
    requestFolder: () => ipcRenderer.invoke("request-folder-open"),

    setSettings: (data: any) => ipcRenderer.invoke("set-settings", data),
    readSettings: () => ipcRenderer.invoke("read-settings"),

    runPython: (data: RunPythonPayload) => ipcRenderer.invoke("run-python-code", data),

    startLiveServer: (htmlPath: string) => ipcRenderer.invoke("start-live-server", htmlPath),
    stopLiveServer: () => ipcRenderer.invoke("stop-live-server"),

    onStatusUpdate: (callback: any) => ipcRenderer.on("status-update", callback),

    sendCommand: (data: any) => ipcRenderer.send("terminal-command", data),
    sendInput: (input: any) => ipcRenderer.send("terminal-input", input),
    killProcess: () => ipcRenderer.send("terminal-kill"),
    cleanupTerminal: () => ipcRenderer.send("terminal-cleanup"),
    onCommandResult: (callback: any) => {
        const listener = (event: any, result: any) => callback(result)
        ipcRenderer.on("terminal-result", listener)
        return () => ipcRenderer.removeListener("terminal-result", listener)
    },

    requestExtensions: () => ipcRenderer.invoke("request-extensions"),
    requestExtension: (name: string) => ipcRenderer.invoke("request-extension", name),
    createDebuggerWindow: () => ipcRenderer.invoke("create-debugger-window"),
    loadExtensionModule: (name: string, version: string) => ipcRenderer.invoke("load-module", name, version),

    readFile: (path: string, parentPath: string) => ipcRenderer.invoke("read-file", path, parentPath),

    removeByPath: (path: string) => ipcRenderer.invoke("remove-by-path", path),

    sendDebuggerData: (data: any) => ipcRenderer.send("debugger-data", data),
    onDebuggerReady: () => {
        return new Promise((resolve) => {
            const handler = (_: any, args: any[]) => {
                resolve(args)
                ipcRenderer.removeListener("debugger-ready", handler)
            }

            ipcRenderer.on("debugger-ready", handler)
        })
    },
    mainReady: () => ipcRenderer.send("main-ready"),

    getPython: () => ipcRenderer.invoke("get-python-info"),
    getDirname: () => ipcRenderer.invoke("get-dirname"),
    getPlatform: () => ipcRenderer.invoke("get-platform"),

    typescriptDiagnostic: (code: string) => ipcRenderer.invoke("typescript-diagnostic", code),
    javascriptDiagnostic: (code: string) => ipcRenderer.invoke("javascript-diagnostic", code),
    javascriptAST: (code: string) => ipcRenderer.invoke("javascript-ast", code),
    typescriptAST: (code: string) => ipcRenderer.invoke("typescript-ast", code),

    // for extensions

    ext: {
        ui: {
            theme: {
                onRegister: (callback: any) => 
                    ipcRenderer.on("new-theme-register", (event: string, name: string, data: any) => callback(name, data)),
            },
            css: {
                onLoad: (callback: any) => 
                    ipcRenderer.on("load-css", (event: any, name: any, content: any) => callback(name, content)),
            },
        },
        editor: {
            language: {
                register: (data: any) =>
                    ipcRenderer.send("language-register", data),
                onRegister: (callback: any) => 
                    ipcRenderer.on("on-language-register", (event: any, data: any) => callback(data)),
                onIconsRegister: (callback: any) => 
                    ipcRenderer.on("new-language-icons-register", (event: any, data: any) => callback(data)),
                onChangeHLRules: (callback: any) => 
                    ipcRenderer.on("on-editor-change-new-hl-rules", (event: any, data: any) => callback(data)),
            },
            api: {
                onReplace: (callback: any) => 
                    ipcRenderer.on("editor-api-replace", (event: any, data: any) => callback(data)),  
            },
            dir: {
                onIconsRegister: (callback: any) => 
                    ipcRenderer.on("new-dir-icon-register", (event: any, data: any) => callback(data)),
            },
            docs: {
                register: (data: any) =>
                    ipcRenderer.send("docs-register", data),
                onRegister: (callback: any) => 
                    ipcRenderer.on("new-documentation-register", (event: any, data: any) => callback(data)),
            }
        },
        app: {
            onNotification: (callback: any) => 
                ipcRenderer.on("extension-notification", (event: any, name: any, data: any) => callback(name, data)),
            onLog: (callback: any) => 
                ipcRenderer.on("extension-log", (event: any, data: any) => callback(data)),
            onAudioPlay: (callback: any) => 
                ipcRenderer.on("extension-play-sound", (event: any, data: any) => callback(data)),
        }
    },

    runExtension: (code: string, permissions: object, meta: object) => ipcRenderer.invoke("run-extension", code, permissions, meta),
    
    onCustomLanguageRegistration: () => {
        return new Promise((resolve) => {
            if (isRegisteredCustomLanguageRegistration) {
                resolve(null)
                return
            }

            ipcRenderer.once("custom-language-registered", () => {
                isRegisteredCustomLanguageRegistration = true
                resolve(null)
            })
        })
    },
    sendCustomLanguageRegistrationReady: () => {
        ipcRenderer.send("custom-language-registration-ready")
    },
    
    triggers: {
        sendFileOpened: (data: any) => ipcRenderer.send("file-opened-event", data),
        sendAceChanged: (data: any) => ipcRenderer.send("ace-changed-event", data),
        sendAceClicked: (data: any) => ipcRenderer.send("ace-clicked-event", data),
    },

    // 

    onAuthMsg: (callback: any) => ipcRenderer.on("auth-msg", (event: any, data: any) => callback(data)),
    sendAuthMsg: (data: any) => ipcRenderer.send("auth-msg", data),
    
    on: (event: any, msg: any) => ipcRenderer.on(event, msg),
    oncb: (event: any, cb: any) => ipcRenderer.on(event, (_: any, data: any) => cb(data)),
});
