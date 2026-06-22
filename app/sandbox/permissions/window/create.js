const { createNativeImageFromUrl } = require("../../tools.js")
const { BrowserWindow } = require("electron")

function isValidExtensionUrl(urlStr) {
    if (typeof urlStr !== 'string') return false
    if (urlStr.includes('@') || urlStr.includes('#') || urlStr.includes('?') || urlStr.includes('/')) return false
    if (!/^[a-zA-Z0-9][a-zA-Z0-9\-.]+$/.test(urlStr)) return false
    return true
}

function callback(data) {
    return (id, properties = {}) => {
        if (id == undefined) {
            id = Math.floor(Math.random() * 9999) + 1
        }

        const title = properties.title == undefined ? `${data.extensionName} Window` : properties.title
        const rawUrl = properties.url == undefined ? `google.com` : properties.url

        if (!isValidExtensionUrl(rawUrl)) {
            throw new Error(`Invalid URL provided for extension window: "${rawUrl}"`)
        }

        const win = new BrowserWindow({
            width: 800,
            height: 600,
            show: false,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true
            }
        })
        win.setMenu(null)

        win.setTitle(title)
        win.loadURL(`https://${rawUrl}`)

        return {
            id: id,
            open: () => {
                win.show()
            },
            close: () => {
                win.close()
            }
        }
    }
}

module.exports = { callback }