const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    close: () => ipcRenderer.send("close"),
    setNonAccountMode: (value) => ipcRenderer.invoke("set-non-account-mode", value),
    reload: () => ipcRenderer.send("reload"),
    onStatusUpdate: (callback) => ipcRenderer.on("status-update", (_, data) => callback(data))
});
