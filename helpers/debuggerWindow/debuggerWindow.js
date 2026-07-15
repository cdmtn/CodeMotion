const { BrowserWindow, nativeImage, app, ipcMain } = require("electron")
const path = require("path")
const bus = require("../eventBus.js")

const { getAppIcon } = require("../../app/main/helpers/requests.js")
const { ASSETS_PATH } = require("../../app/main/helpers/paths.js")

async function createDebuggerWindow(mainWindow, title = "Debugger") {
    const overlayIconPath = path.join(ASSETS_PATH, "media", "debugger_icon.png")
    const appIcon = await getAppIcon()

    const win = new BrowserWindow({
        width: 800,
        height: 600,
        title,
        icon: appIcon,
        resizable: false,
        backgroundColor: "#0f0f0f",
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, "preload.js")
        }
    })
    win.setMenu(null)

    win.loadFile(path.join(__dirname, "index.html"))

    try {
        const overlay = nativeImage.createFromPath(overlayIconPath)
        if (!overlay.isEmpty()) {
            win.setOverlayIcon(overlay, "Debugger active")
        }
    } catch (err) {
        console.warn("Overlay icon error:", err)
    }

    debuggerWindow = win
    debuggerWindow.name = "debuggerWindow"

    win.on("closed", () => {
        debuggerWindow = null
    })

    ipcMain.on("debugger-ready", (event) => {
        mainWindow.webContents.send("debugger-ready")
        bus.emit("debugger-ready", event.sender);

        ipcMain.on("debugger-data", (event, data) => {
            if (debuggerWindow && !debuggerWindow.isDestroyed()) {
                debuggerWindow.webContents.send("debug-event", {
                    data,
                    time: Date.now()
                })
            }
        })
    })

    ipcMain.on('close-window', () => {
        if (debuggerWindow) {
            debuggerWindow.close();
        }
    });

    return win
}

module.exports = { createDebuggerWindow }