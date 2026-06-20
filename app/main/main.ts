import type { IpcMainEvent } from "electron"

import { app, BrowserWindow, screen, ipcMain, shell } from "electron"
import path from "node:path"
import fs from "node:fs"
import { GlobalKeyboardListener } from "node-global-key-listener";

const v = new GlobalKeyboardListener();
let keyboardListener: ((e: any, down: any) => void) | null = null;
const bus = require("../../helpers/eventBus")

const { verifyToken } = require("../auth")

const { HTML_PATH, JSON_PATH } = require("../main/helpers/paths.js")

let mainWindow: any
let workSeconds: number = 0

require("../sandbox/sandbox")
require("../../helpers/getPython")
require("../auth")
require("../electron/live-server")
require("./runtime/runtimeHandler")
require("./tools/diagnostics")
require("./tools/javascript/ast")
require("./tools/typescript/ast-ts")

require("./ipc/filesWork")
require("./ipc/api")
require("./ipc/getters")
require("./ipc/setters")
require("./ipc/updaters")
require("./ipc/misc")
require("./ipc/organizations")
require("./ipc/bugs")

// ext
require("../sandbox/regs/language")
require("../sandbox/regs/docs")

console.log("APP PATH:", app.getAppPath());

const { terminalManager } = require("../main/helpers/terminal.js")

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
} = require("../main/helpers/requests.js")

const { spawnNotification, notifications } = require("../notifications/notifications.js")

const { 
    selectFile, 
    selectFolder,
} = require("../main/helpers/os.js");

const { APP_PATH } = require('../main/helpers/paths.js');

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
    const appIcon = getAppIcon();
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
        shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.webContents.on('did-finish-load', () => {
        if(splash) splash.destroy();
        mainWindow.maximize()
        mainWindow.show();
    })
    mainWindow.on("closed", () => {
        if (keyboardListener) {
            v.removeListener(keyboardListener)
            keyboardListener = null
        }
        for (const win of notifications) {
            if (win && !win.isDestroyed()) win.close()
        }
    })

    if(splash) updateSplash("Waiting for connect...")

    // if offline mode (w/o account) then dont check status
    if (localData.nonAccountMode) {
        await mainWindow.loadFile(path.join(HTML_PATH, "index.html"));
    }
    else {
        checkStatus({ updateSplash: updateSplash })
            .then(async () => {
                if (!localData.token) {
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

                keyboardListener = function (e: any, down: any) {
                    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused() && e.state == "DOWN" && e.name == "S" && down["LEFT CTRL"]) {
                        mainWindow.webContents.send("keyboard_action", {
                            type: "saved"
                        });
                    }
                }
                v.addListener(keyboardListener);
            })
            .catch((err: TypeError) => {
                updateSplash(`Error: ${err.message}. Please report this error to the developer and try again later`, true)
            });
    }

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
            mainWindow.maximize();
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

    return { mainWindow, splash };
}

ipcMain.on("spawn-notification", (_: IpcMainEvent, data: any) => {
    spawnNotification(data)
})

app.whenReady().then(createWindow);

app.on('before-quit', () => {
    terminalManager.killProcessTree(true);
    terminalManager.cleanupInputHandler();
    if (keyboardListener) {
        v.removeListener(keyboardListener);
        keyboardListener = null;
    }
});

setInterval(() => {
    workSeconds += 0.1
}, 100)

app.on('window-all-closed', () => {
    bus.emit("main-closed", mainWindow);
    terminalManager.killProcessTree(true);
    terminalManager.cleanupInputHandler();
    if (keyboardListener) {
        v.removeListener(keyboardListener);
        keyboardListener = null;
    }

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

    if (process.platform !== 'darwin') app.quit();
});
