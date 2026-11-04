import type { IpcMainEvent } from "electron"

import { app, BrowserWindow, screen, ipcMain, shell, Notification } from "electron"
import path from "node:path"
import fs from "node:fs"

const bus = require("../../helpers/eventBus")

const { verifyToken } = require("../auth")

const { HTML_PATH, JSON_PATH } = require("./helpers/paths.js")
import { isUrlSafe } from "./helpers/urlValidator"

let mainWindow: any
let workSeconds: number = 0

process.on("uncaughtException", (err: Error) => {
    console.error("[main] Uncaught exception:", err)
})

process.on("unhandledRejection", (reason: unknown) => {
    console.error("[main] Unhandled rejection:", reason)
})

require("../sandbox/sandbox")
require("../../helpers/getPython")
require("../auth")
require("../electron/live-server")
require("./runtime/runtimeHandler")
require("./tools/diagnostics")
require("./tools/js-ts/ast")
require("./tools/go/ast")
require("./tools/json/ast")
require("./tools/yaml/ast")
require("./tools/python/ast")

require("./ipc/filesWork")
require("./ipc/fileWatcher")
require("./ipc/api")
require("./ipc/getters")
require("./ipc/setters")
require("./ipc/updaters")
require("./ipc/misc")
require("./ipc/organizations")
require("./ipc/bugs")
require("./ipc/suggest")
require("./ipc/github-oauth")
require("./ipc/gitlab-oauth")

// ext
require("../sandbox/regs/language")
require("../sandbox/regs/docs")
require("../sandbox/regs/filenames")
require("../sandbox/regs/fileExtensions")
require("../sandbox/regs/templates")

console.log("APP PATH:", app.getAppPath());

const { terminalManager } = require("./helpers/terminal.js")

const { createDebuggerWindow } = require("../../helpers/debuggerWindow/debuggerWindow.js");
const { createSplashWindow, updateSplash } = require('../splash/splash.js');
const { 
    readSettings, 
    writeSettings,
    ensureLocalJson,
    ensureSettingsJson,
    ensureLocalBugs,
    getLocalAppData,
    getSettingsData,
    getAppIcon,
    checkStatus,
} = require("./helpers/requests.js")

const { spawnNotification, notifications } = require("../notifications/notifications.js")

const { 
    selectFile, 
    selectFolder,
} = require("./helpers/os.js");

const { APP_PATH } = require('./helpers/paths.js');

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
    const isPackaged = app.isPackaged;
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    let dev = false
    let splash: InstanceType<typeof BrowserWindow> | null = null

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
            preload: path.join(APP_PATH, "dist", "preload.js"),
            contextIsolation: true
        },
        icon: appIcon
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
        if (isUrlSafe(url)) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });
    mainWindow.webContents.on('did-finish-load', () => {
        if(splash) splash.destroy();
        mainWindow.maximize()
        mainWindow.show();
    })
    mainWindow.on("closed", () => {
        for (const win of notifications) {
            if (win && !win.isDestroyed()) win.close()
        }
    })

    if(splash) updateSplash("Waiting for connect...")

    if (localData.nonAccountMode) {
        await mainWindow.loadFile(path.join(HTML_PATH, "index.html"));
    }
    else if (!localData.token) {
        await mainWindow.loadFile(path.join(HTML_PATH, "login.html"));
    }
    else {
        let userCheckLogin = await verifyToken(localData.token);
        if (userCheckLogin.success) {
            await mainWindow.loadFile(path.join(HTML_PATH, "index.html"));
        }
        else {
            await mainWindow.loadFile(path.join(HTML_PATH, "login.html"));
            mainWindow.webContents.send("auth-msg", { type: "error", content: userCheckLogin.result })
        }
    }

    checkStatus({ updateSplash: updateSplash }).catch((err: TypeError) => {
        console.error("Status check failed (non-blocking):", err.message);
    });

    ipcMain.handle("request-file-open", () => {
        return selectFile(mainWindow)
    })
    ipcMain.handle("request-folder-open", () => {
        return selectFolder(mainWindow)
    })
    ipcMain.on("main-ready", (event: IpcMainEvent) => {
        bus.emit("main-ready", event.sender);
    })
    ipcMain.on("custom-language-registration-ready", () => {
        mainWindow.webContents.send("custom-language-registered")
    })

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
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.on("set-app-title", (_, title) => {
        if (mainWindow) {
            if(title != undefined) {
                mainWindow.setTitle(`${title} - CodeMotion IDE`)
            }
            else {
                mainWindow.setTitle(`CodeMotion IDE`)
            }
        }
    });

    ipcMain.on("reload", () => {
        terminalManager.killProcessTree(true);
        terminalManager.cleanupInputHandler();
        app.relaunch();
        app.quit(); 
    });
    ipcMain.handle("create-debugger-window", async () => {
        createDebuggerWindow(mainWindow)
        return true
    })

    // send app close. Example: close all notification windows
    app.on('window-all-closed', () => {
        bus.emit("main-closed", mainWindow);
    })

    return { mainWindow, splash };
}

ipcMain.on("spawn-notification", (_: IpcMainEvent, data: any) => {
    spawnNotification(data)
})

ipcMain.on("spawn-system-notification", async (_: IpcMainEvent, data: any) => {
    if (!Notification.isSupported()) return

    const icon = await getAppIcon()

    const notif = new Notification({
        title: data.title || "CodeMotion",
        body: data.body || "",
        icon,
        silent: true
    })
    notif.show()
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
});
