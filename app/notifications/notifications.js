const { BrowserWindow, screen, ipcMain, app } = require("electron")
const { HTML_PATH, APP_PATH } = require("../main/helpers/paths.js")

const path = require("path")

const notifications = []

const notifyWidth = 400
const margin = 5
const minHeight = 50
const maxHeight = 200
const maxStack = 5

const bus = require("../../helpers/eventBus")

function updatePositions() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize

    let offset = margin

    for (let i = notifications.length - 1; i >= 0; i--) {
        const win = notifications[i]

        if (!win || win.isDestroyed()) continue

        const [w, h] = win.getSize()

        win.setPosition(
            width - w - margin,
            height - h - offset
        )

        offset += h + margin
    }
}

function closeNotification(win) {
    if (!win || win.isDestroyed()) return
    win.close()
}

function spawnNotification(properties = {}) {
    ipcMain.removeAllListeners("notification-close")

    const timeout = properties.timeout ?? 4000

    const win = new BrowserWindow({
        width: notifyWidth,
        height: minHeight,
        resizable: false,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: false,
        webPreferences: {
            preload: path.join(APP_PATH, "notifications", "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    win.loadFile(path.join(HTML_PATH, "notification.html"))

    notifications.push(win)

    if (notifications.length > maxStack) {
        const old = notifications.shift()
        if (old && !old.isDestroyed()) old.close()
    }

    win.webContents.once("did-finish-load", async () => {
        win.webContents.send("data", properties)

        setTimeout(async () => {
            const contentHeight = await win.webContents.executeJavaScript(
                "document.body.scrollHeight"
            )

            const finalHeight = Math.min(
                Math.max(contentHeight, minHeight),
                maxHeight
            )

            win.setSize(notifyWidth, finalHeight)

            updatePositions()
        }, 50)
    })

    win.on("closed", () => {
        const i = notifications.indexOf(win)
        if (i !== -1) notifications.splice(i, 1)

        updatePositions()
    })

    updatePositions()

    if (timeout > 0) {
        setTimeout(() => {
            closeNotification(win)
        }, timeout)
    }

    ipcMain.on("notification-close", (event) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (win && !win.isDestroyed()) win.close()
    })

    return win
}

module.exports = { spawnNotification, notifications }