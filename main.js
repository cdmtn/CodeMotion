const { app, BrowserWindow, screen, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os')
const https = require("https");
const { spawn } = require("child_process")
const { GlobalKeyboardListener } = require("node-global-key-listener");
const v = new GlobalKeyboardListener();
const http = require("http")
const WebSocket = require("ws")
const chokidar = require("chokidar")
const bus = require("./helpers/eventBus.js")

const { verifyToken } = require("./app/auth.js")

const { 
    SETTINGS_PATH, 
    LOCAL_BUGS_PATH, 
    LOCAL_FILE_PATH, 
    PACKAGE_FILE_PATH,
    HTML_PATH,
    JSON_PATH,
    SPLASH_HTML_PATH,
    INDEX_HTML_PATH,
    LOGIN_HTML_PATH,
    REGISTER_HTML_PATH,
    ASSETS_PATH,
    DEFAULT_ICON,
    PRELOAD_PATH,
    API
} = require("./app/helpers/paths.js")

let mainWindow;
let workSeconds = 0

require("./app/sandbox/sandbox.js")
require("./helpers/files.js")
require("./helpers/getPython.js")
require("./app/auth.js")
require("./app/electron/live-server.js")
require("./app/runtime/runtimeHandler.js")
const { terminalManager } = require("./app/helpers/terminal.js")

const { createDebuggerWindow } = require("./helpers/debuggerWindow/debuggerWindow.js");
const { createSplashWindow, updateSplash } = require('./app/splash.js');
const { 
    readSettings, 
    deepMerge,
    writeLocalBugs,
    writeSettings,
    ensureLocalJson,
    ensureSettingsJson,
    ensureLocalBugs,
    getLocalAppData,
    getSettingsData,
    getLocalBugsData,
    getPackageData,
    getAppIcon,
    readFilesInFolder,
    readFileContent,
    updateLocalAppData,
    checkStatus,
    getAllLanguages,
    getAllLanguagesJSON,
    getUserToken,
    requestAddBug,
    requestMakeVerifyBug,
    requestGetYourOrgColleagues,
    getUsedLanguagesByPath
} = require("./app/helpers/requests.js")

const { 
    selectFile, 
    selectFolder,
    saveFile,
    readDirTree
} = require("./app/helpers/os.js");

const { APP_PATH } = require('./app/helpers/paths.js');
const { checkFields } = require('./app/sandbox/tools.js');

console.log(`App started on ${process.arch} system`)

async function createWindow() {
    if (!fs.existsSync(JSON_PATH)) {
        fs.mkdirSync(JSON_PATH, { recursive: true });
    }
    
    ensureLocalJson();
    ensureLocalBugs();
    ensureSettingsJson();

    const localData = getLocalAppData();
    const settingsData = getSettingsData()
    const appIcon = await getAppIcon();

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    let dev = false
    let splash = false

    if("app" in settingsData && settingsData.app.splashScreen) {
        splash = await createSplashWindow()
    }

	if(process.argv.includes('--d')) dev = true

    mainWindow = new BrowserWindow({
        width,
        height,
        show: false,
        frame: dev,
        backgroundColor: "#0a0a0a",
        webPreferences: {
            preload: path.join(APP_PATH, "preload.js"),
            contextIsolation: true
        },
        icon: appIcon
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.webContents.on('did-finish-load', () => {
        if(splash) splash.destroy();
        mainWindow.maximize()
        mainWindow.show();
    })

    if(splash) updateSplash("Waiting for connect...")

    checkStatus({ updateSplash: updateSplash })
        .then(async () => {
            if(localData.nonAccountMode) {
                await mainWindow.loadFile(path.join(HTML_PATH, "index.html"));
            }
            else if (!localData.token) {
                await mainWindow.loadFile(path.join(HTML_PATH, "login.html"));
            } else {
                let userCheckLogin = await verifyToken(localData.token);

                if (userCheckLogin.success) {
                    await mainWindow.loadFile(path.join(HTML_PATH, "index.html"));
                }
                else {
                    await mainWindow.loadFile(path.join(HTML_PATH, "login.html"));
                    mainWindow.webContents.send("auth-msg", { type: "error", content: userCheckLogin.result })
                }
            }

            v.addListener(function (e, down) {
                if (mainWindow && mainWindow.isFocused() && e.state == "DOWN" && e.name == "S" && down["LEFT CTRL"]) {
                    mainWindow.webContents.send("keyboard_action", {
                        type: "saved"
                    });
                }
            });
        })
        .catch(err => {
            updateSplash(`Error: ${err.message}. Please report this error to the developer and try again later`, true)
        });

    ipcMain.handle("request-file-open", () => {
        return selectFile(mainWindow)
    })
    ipcMain.handle("request-folder-open", () => {
        return selectFolder(mainWindow)
    })
    ipcMain.on("main-ready", (event) => {
        bus.emit("main-ready", event.sender);
    })
    ipcMain.on("custom-language-registration-ready", (event) => {
        mainWindow.webContents.send("custom-language-registered")
    })

    return { mainWindow, splash };
}

ipcMain.on("close", () => {
    terminalManager.killProcessTree(true);
    terminalManager.cleanupInputHandler();
    app.quit();
});

ipcMain.on("minimize", () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on("fullscreen", () => {
    if (mainWindow) {
        mainWindow.maximize();
    }
});

ipcMain.on("reload", () => {
    terminalManager.killProcessTree(true);
    terminalManager.cleanupInputHandler();
    app.relaunch();
    app.quit(); 
});

ipcMain.handle('readDirTree', async (_e, rootPath, options = {}) => {
    return readDirTree(rootPath, options);
});

ipcMain.handle('save-file', async (event, fullPath, content) => {
    return await saveFile(fullPath, content);
});

ipcMain.handle('readFileContent', async (_e, filePath, encoding = 'utf8') => {
    return readFileContent(filePath, encoding);
});

ipcMain.handle('get-package-data', async (_e) => {
    return getPackageData()
});

ipcMain.handle('get-local-bugs-data', async (_e) => {
    return getLocalBugsData()
});

ipcMain.handle("get-user-pc-info", async (event) => {
    return {
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        hostname: os.hostname(),
        homedir: os.homedir()
    };
});

ipcMain.on('update-local-app-data', async (_e, data) => {
    updateLocalAppData(data)
});

ipcMain.handle('get-all-app-icons', () => {
    return readFilesInFolder("./assets/media/icons");
});

ipcMain.handle('get-user-data-from-api', async (event) => {
    let localData = await readFileContent(LOCAL_FILE_PATH)
    localData = JSON.parse(localData)

    let api = `${API}/getMe.php`

    try {
        const response = await fetch(api, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${localData.token}`
            }
        });
        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                result: result
            }
        }
        
        return {
            success: true,
            result: result
        }
    } catch (error) {
        return {
            success: false,
            result: error.message,
        }
    }
})
ipcMain.handle('get-org-data-from-api', async (event, orgID) => {
    let api = `${API}/getOrg.php?id=${orgID}`

    try {
        const response = await fetch(api);
        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                result: result
            }
        }
        
        return {
            success: true,
            result: result
        }
    } catch (error) {
        return {
            success: false,
            result: error.message,
        }
    }
})
ipcMain.handle("set-settings", (event, data) => {
    if (!data || typeof data !== "object") {
        return readSettings();
    }
    return writeSettings(data);
});
ipcMain.handle("open-in-browser", (event, url) => {
    shell.openExternal(url);
});
ipcMain.handle("reveal-in-file-explorer", async (event, targetPath) => {
    if (!targetPath || typeof targetPath !== "string") {
        return { success: false, error: "Invalid path" }
    }

    shell.showItemInFolder(path.resolve(targetPath))
    return { success: true }
})
ipcMain.handle("create-file", async (event, targetPath) => {
    try {
        const resolvedPath = path.resolve(targetPath)
        const handle = await fs.promises.open(resolvedPath, "wx")
        await handle.close()
        return { success: true, path: resolvedPath }
    } catch (err) {
        return { success: false, error: err.message }
    }
})
ipcMain.handle("create-folder", async (event, targetPath) => {
    try {
        const resolvedPath = path.resolve(targetPath)
        await fs.promises.mkdir(resolvedPath)
        return { success: true, path: resolvedPath }
    } catch (err) {
        return { success: false, error: err.message }
    }
})
async function copyRecursive(src, dest) {
    const stat = await fs.promises.stat(src);
    if (stat.isDirectory()) {
        await fs.promises.mkdir(dest, { recursive: true });
        const entries = await fs.promises.readdir(src);
        for (const entry of entries) {
            await copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
    } else {
        await fs.promises.copyFile(src, dest);
    }
}

ipcMain.handle("rename-path", async (event, oldPath, newPath) => {
    const resolvedOldPath = path.resolve(oldPath);
    const resolvedNewPath = path.resolve(newPath);
    try {
        await fs.promises.rename(resolvedOldPath, resolvedNewPath);
        return { success: true, path: resolvedNewPath };
    } catch (err) {
        if ((err.code === "EPERM" || err.code === "EACCES") && process.platform === "win32") {
            try {
                await copyRecursive(resolvedOldPath, resolvedNewPath);
                await fs.promises.rm(resolvedOldPath, { recursive: true, force: true });
                return { success: true, path: resolvedNewPath };
            } catch (fallbackErr) {
                return { success: false, error: fallbackErr.message };
            }
        }
        return { success: false, error: err.message };
    }
})
ipcMain.handle("get-app-icons", async () => {
    try {
        const dir = path.join(ASSETS_PATH, "media", "app-icons")
        const files = await fs.promises.readdir(dir)
        const result = []

        for (const file of files) {
            const fullPath = path.join(dir, file)
            const stat = await fs.promises.stat(fullPath)

            if (stat.isFile()) {
                result.push(file)
            }
        }

        return result
    } catch (err) {
        console.error("get-app-icons error:", err)
        return []
    }
})
ipcMain.handle("get-app-local", async () => {
    return await getLocalAppData()
})
ipcMain.handle("get-all-languages", async () => {
    return await getAllLanguages()
})
ipcMain.handle("get-all-languages-json", async () => {
    return await getAllLanguagesJSON()
})

ipcMain.handle("read-settings", () => {
    return readSettings();
});

ipcMain.handle("read-comments", () => {
    return readComments();
});

ipcMain.handle("get-app-icon", async () => {
    return await getAppIcon()
})

ipcMain.handle("create-debugger-window", async (event) => {
    createDebuggerWindow(mainWindow)
    return true
})

ipcMain.handle("get-dirname", async (event) => {
    return __dirname
})

ipcMain.handle("remove-by-path", async (event, targetPath) => {
    try {
        if (!targetPath || typeof targetPath !== "string") {
            throw new Error("Invalid path")
        }

        const resolvedPath = path.resolve(targetPath)

        if (!fs.existsSync(resolvedPath)) {
            return { success: false, error: "Path does not exist" }
        }

        const stat = fs.lstatSync(resolvedPath)

        if (stat.isDirectory()) {
            fs.rmSync(resolvedPath, { recursive: true, force: true })
        } else {
            fs.unlinkSync(resolvedPath)
        }

        return { success: true }
    } catch (err) {
        return { success: false, error: err.message }
    }
})

ipcMain.handle("modify-local-bugs", async (_, { type, data }) => {
    function normalizeBug(bug) {
        if (!bug || typeof bug !== "object") {
            throw new Error("Bug must be an object")
        }

        return {
            id: bug.id ?? crypto.randomUUID(),
            priority: Number.isInteger(bug.priority) ? bug.priority : 0,
            value: String(bug.value || "").trim(),
            description: String(bug.description || "").trim(),
            self: Boolean(bug.self),
            time: Number.isInteger(bug.time)
                ? bug.time
                : Math.floor(Date.now() / 1000),
            resolved: Number.isInteger(bug.resolved) ? bug.resolved : 0,
            organization: bug.organization
                ? String(bug.organization).trim()
                : ""
        }
    }

    function writeBugs(data) {
        if (!Array.isArray(data)) {
            throw new Error("Data must be an array")
        }

        const normalized = data.map(normalizeBug)

        fs.writeFileSync(
            LOCAL_BUGS_PATH,
            JSON.stringify(normalized, null, 4),
            "utf8"
        )

        return normalized
    }

    try {
        let bugs = getLocalBugsData()

        switch (type) {
            case "add": {
                const bug = normalizeBug(data)

                bugs.push(bug)
                writeBugs(bugs)

                return {
                    success: true,
                    data: bug
                }
            }

            case "edit": {
                if (typeof data?.id === "undefined") {
                    return {
                        success: false,
                        error: "Missing data.id"
                    }
                }

                const normalizedBug = normalizeBug(data)

                const index = bugs.findIndex(
                    bug => String(bug.id) === String(normalizedBug.id)
                )

                if (index === -1) {
                    return {
                        success: false,
                        error: "Bug not found"
                    }
                }

                bugs[index] = normalizedBug
                writeBugs(bugs)

                return {
                    success: true,
                    data: normalizedBug
                }
            }

            case "remove": {
                if (typeof data?.id === "undefined") {
                    return {
                        success: false,
                        error: "Missing data.id"
                    }
                }

                const initialLength = bugs.length

                bugs = bugs.filter(
                    bug => String(bug.id) !== String(data.id)
                )

                if (bugs.length === initialLength) {
                    return {
                        success: false,
                        error: "Bug not found"
                    }
                }

                writeBugs(bugs)

                return {
                    success: true
                }
            }

            case "set": {
                if (!Array.isArray(data)) {
                    return {
                        success: false,
                        error: "Data must be an array"
                    }
                }

                const normalized = writeBugs(data)

                return {
                    success: true,
                    data: normalized
                }
            }

            default:
                return {
                    success: false,
                    error: "Unknown type"
                }
        }
    }
    catch (e) {
        console.error("Handler error:", e)

        return {
            success: false,
            error: e.message
        }
    }
})

ipcMain.handle('ask-to-save-content', async (event, filename, content) => {
    try {
        const result = await dialog.showSaveDialog({
            title: 'Save a new file',
            defaultPath: filename,
            buttonLabel: 'Save',
            properties: ['createDirectory']
        });

        if (result.canceled || !result.filePath) {
            return { success: false, canceled: true };
        }

        await fs.promises.writeFile(result.filePath, content, 'utf-8');

        return {
            success: true,
            path: result.filePath
        };

    } catch (err) {
        console.error('Save error:', err);

        return {
            success: false,
            error: err.message
        };
    }
});

ipcMain.handle("get-platform", (e) => {
    return process.platform
})

ipcMain.handle("get-user-token", async () => {
    return await getUserToken()
})

ipcMain.handle("request-add-bug", async (_, params) => {
    return await requestAddBug(params)
})
ipcMain.handle("request-make-verify-bug", async (_, params) => {
    return await requestMakeVerifyBug(params)
})
ipcMain.handle("request-get-your-org-colleagues", async (_, params) => {
    return await requestGetYourOrgColleagues(params)
})
ipcMain.handle("get-used-languages-by-path", async (_, targetPath) => {
    return await getUsedLanguagesByPath(targetPath)
})

app.whenReady().then(createWindow);

app.on('before-quit', () => {
    terminalManager.killProcessTree(true);
    terminalManager.cleanupInputHandler();
});

setInterval(() => {
    workSeconds += 0.1
}, 100)

app.on('window-all-closed', () => {
    terminalManager.killProcessTree(true);
    terminalManager.cleanupInputHandler();

    if (process.platform !== 'darwin') app.quit();

    const settings = readSettings()

    if("app" in settings) {
        if("workSeconds" in settings.app) {
            let seconds = settings.app.workSeconds
            writeSettings({ app: { workSeconds: Math.round((workSeconds + seconds) * 10) / 10 }})
        }
        if("workSecondsSession" in settings.app) {
            writeSettings({ app: { workSecondsSession: Math.round(workSeconds * 10) / 10 }})
        }
    }

    console.log(`Worked: ${workSeconds}s`)
});
