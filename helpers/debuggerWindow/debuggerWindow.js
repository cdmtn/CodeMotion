const { BrowserWindow, nativeImage, app, ipcMain, clipboard } = require("electron")
const path = require("path")
const fs = require("fs")
const { exec } = require("child_process")
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

    ipcMain.on('debugger-copy-text', (event, text) => {
        clipboard.writeText(text)
    });

    ipcMain.on('debugger-copy-as-file', (event, text) => {
        const now = new Date()
        const pad = (n) => String(n).padStart(2, "0")
        const datetime = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
        const filename = `Debugger-cdmtn-${datetime}.txt`
        const tmpDir = app.getPath("temp")
        const filePath = path.join(tmpDir, filename)

        fs.writeFileSync(filePath, text, "utf-8")

        const escapedPS = filePath.replace(/'/g, "''")
        const escapedOSA = filePath.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
        const escapedURL = encodeURI("file://" + filePath)

        if (process.platform === 'win32') {
            exec(
                `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetFileDropList(@('${escapedPS}'))"`,
                (err) => {
                    if (err) clipboard.writeText(text)
                }
            )
        } else if (process.platform === 'darwin') {
            exec(
                `osascript -e 'set the clipboard to (POSIX file "${escapedOSA}")'`,
                (err) => {
                    if (err) clipboard.writeText(text)
                }
            )
        } else {
            exec(
                `xclip -selection clipboard -t text/uri-list <<< "${escapedURL}"`,
                (err) => {
                    if (err) clipboard.writeText(text)
                }
            )
        }
    });

    return win
}

module.exports = { createDebuggerWindow }