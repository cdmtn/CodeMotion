const { BrowserWindow, app } = require("electron")
const { SPLASH_HTML_PATH } = require("../main/helpers/paths.js")
const { getAppIcon } = require("../main/helpers/requests.js")
const path = require("path")

let splash;

async function createSplashWindow() {
    const appIcon = getAppIcon()

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
            preload: path.join(__dirname, "splash-preload.js")
        },
        icon: appIcon
    });

    splash.loadFile(SPLASH_HTML_PATH)

    return splash
}

function updateSplash(text, isError = false) {
    if(splash && !splash.isDestroyed()) {
        splash.webContents.send("status-update", { msg: text, error: isError });
    }
}

module.exports = { createSplashWindow, updateSplash }