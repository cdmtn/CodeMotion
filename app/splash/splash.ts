import { BrowserWindow } from "electron"

const { PRELOAD_PATH, SPLASH_HTML_PATH } = require("../dist/helpers/paths.js")
const { getAppIcon } = require("../dist/helpers/requests.js")

let splash: BrowserWindow | undefined

async function createSplashWindow(): Promise<BrowserWindow> {
    const appIcon = await getAppIcon()

    splash = new BrowserWindow({
        width: 800,
        height: 500,
        frame: false,
        alwaysOnTop: true,
        transparent: false,
        resizable: false,
        center: true,
        show: true,
        webPreferences: {
            preload: PRELOAD_PATH
        },
        icon: appIcon
    })

    splash.loadFile(SPLASH_HTML_PATH)

    return splash
}

function updateSplash(text: string, isError = false): void {
    if (splash) {
        splash.webContents.send("status-update", { msg: text, error: isError })
    }
}

export { createSplashWindow, updateSplash }
