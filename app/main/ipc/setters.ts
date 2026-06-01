import { ipcMain, IpcMainInvokeEvent } from "electron"
import { readSettings, writeSettings } from "../helpers/requests"

ipcMain.handle("set-settings", (_: IpcMainInvokeEvent, data: unknown) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return readSettings()
    }

    return writeSettings(data as object)
})