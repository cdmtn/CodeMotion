const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    ready: () => ipcRenderer.send("debugger-ready"),
    close: () => ipcRenderer.send("close-window"),
    onDebugData: (callback) => ipcRenderer.on("debug-event", (_, data) => callback(data)),
    runExtension: (code, permissions, meta) => ipcRenderer.invoke("run-extension", code, permissions, meta),
    copyText: (text) => ipcRenderer.send("debugger-copy-text", text),
    copyAsFile: (text) => ipcRenderer.send("debugger-copy-as-file", text)
});