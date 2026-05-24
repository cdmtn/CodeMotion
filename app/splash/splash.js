const { BrowserWindow, app } = require("electron")
const { PRELOAD_PATH, SPLASH_HTML_PATH } = require("../helpers/paths.js")
const { getAppIcon } = require("../helpers/requests.js")

let splash;

async function createSplashWindow() {
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
    });

    splash.loadFile(SPLASH_HTML_PATH)

    return splash
}

function updateSplash(text, isError = false) {
    if(splash) {
        splash.webContents.send("status-update", { msg: text, error: isError });
    }
}

module.exports = { createSplashWindow, updateSplash }