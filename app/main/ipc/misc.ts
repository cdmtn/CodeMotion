import { ipcMain, IpcMainInvokeEvent, shell } from "electron";

function isAllowedExternalUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

ipcMain.handle("open-in-browser", (_: IpcMainInvokeEvent, url: string) => {
    if (!isAllowedExternalUrl(url)) {
        throw new Error("Only http: and https: URLs are allowed");
    }
    shell.openExternal(url);
});