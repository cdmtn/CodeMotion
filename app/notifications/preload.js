const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("electron", {
    onData: callback => {
        ipcRenderer.on("data", (_, data) => callback(data))
    },
    close: () => ipcRenderer.send("notification-close")
})