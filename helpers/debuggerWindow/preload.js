const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    ready: () => ipcRenderer.send("debugger-ready"),
    close: () => ipcRenderer.send("close-window"),
    onDebugData: (callback) => ipcRenderer.on("debug-event", (_, data) => callback(data))
});