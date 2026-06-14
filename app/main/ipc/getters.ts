import { ipcMain, IpcMainInvokeEvent } from "electron";
import os from "node:os"
import {
    getAllLanguages,
    getAllLanguagesJSON,
    getAppIcon,
    getLocalAppData,
    getLocalBugsData,
    getPackageData,
    getUsedLanguagesByPath,
    getUserToken,
    readFilesInFolder,
    readSettings
} from "../helpers/requests";
import path from "node:path";
import fs from "node:fs"
import { ASSETS_PATH } from "../helpers/paths";

ipcMain.handle('get-package-data', async () => {
    return getPackageData()
});
ipcMain.handle('get-local-bugs-data', async () => {
    return getLocalBugsData()
});
ipcMain.handle("get-user-pc-info", async () => {
    return {
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        hostname: os.hostname(),
        homedir: os.homedir()
    };
});
ipcMain.handle('get-all-app-icons', () => {
    return readFilesInFolder("assets/media/icons");
});
ipcMain.handle('get-all-filenames-app-icons', () => {
    return readFilesInFolder("assets/media/icons/filenames");
});
ipcMain.handle("get-app-icons", async () => {
    try {
        const dir = path.join(ASSETS_PATH, "media", "app-icons")
        const files = await fs.promises.readdir(dir)
        const result = []

        for (const file of files) {
            const fullPath = path.join(dir, file)
            const stat = await fs.promises.stat(fullPath)

            if (stat.isFile()) {
                result.push(file)
            }
        }

        return result
    } catch (err) {
        console.error("get-app-icons error:", err)
        return []
    }
})
ipcMain.handle("get-app-local", async () => {
    return await getLocalAppData()
})
ipcMain.handle("get-all-languages", async () => {
    return await getAllLanguages()
})
ipcMain.handle("get-all-languages-json", async () => {
    return await getAllLanguagesJSON()
})
ipcMain.handle("get-app-icon", async () => {
    return await getAppIcon()
})
ipcMain.handle("get-dirname", async () => {
    return __dirname
})
ipcMain.handle("get-platform", () => {
    return process.platform
})
ipcMain.handle("get-user-token", async () => {
    return await getUserToken()
})
ipcMain.handle("get-used-languages-by-path", async (_: IpcMainInvokeEvent, targetPath: string) => {
    return await getUsedLanguagesByPath(targetPath)
})
ipcMain.handle("read-settings", () => {
    return readSettings();
});