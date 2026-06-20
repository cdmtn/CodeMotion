const { ipcMain } = require("electron")

const fileOpenedHandlers = new Map()

function callback(data) {
    const cb = data.selfArgs[0]
    const extName = data.extensionName

    const oldHandler = fileOpenedHandlers.get(extName)
    if (oldHandler) {
        ipcMain.removeListener("file-opened-event", oldHandler)
    }

    const handler = (_, eventData) => {
        cb(eventData)
    }
    fileOpenedHandlers.set(extName, handler)
    ipcMain.on("file-opened-event", handler)
}

module.exports = { callback }