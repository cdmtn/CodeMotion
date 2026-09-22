import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron"

contextBridge.exposeInMainWorld("electron", {
    onData: (callback: (data: unknown) => void) => {
        ipcRenderer.on("data", (_event: IpcRendererEvent, data: unknown) => callback(data))
    },
    close: () => ipcRenderer.send("notification-close")
})
