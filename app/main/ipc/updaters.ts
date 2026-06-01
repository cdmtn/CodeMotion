import { ipcMain, IpcMainInvokeEvent } from "electron";
import { updateLocalAppData } from "../helpers/requests";

ipcMain.on('update-local-app-data', async (_: IpcMainInvokeEvent, data: object) => {
    updateLocalAppData(data)
});