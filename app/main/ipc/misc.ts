import { ipcMain, IpcMainInvokeEvent, shell } from "electron";

ipcMain.handle("open-in-browser", (_: IpcMainInvokeEvent, url: string) => {
    shell.openExternal(url);
});