import { dialog, ipcMain, IpcMainInvokeEvent, shell } from "electron"
import path from "node:path"
import fs from "fs"

import { readDirTree, saveFile } from "../helpers/os"
import { readFileContent } from "../helpers/requests"
import { SaveContentPayload } from "../payloads"
import { APP_PATH } from "../helpers/paths"

ipcMain.handle("create-file", async (_: IpcMainInvokeEvent, targetPath: string) => {
    try {
        const resolvedPath = path.resolve(targetPath)
        const handle = await fs.promises.open(resolvedPath, "wx")
        await handle.close()
        return { success: true, path: resolvedPath }
    } catch (err: unknown) {
        return { success: false, error: String(err) }
    }
})
ipcMain.handle("create-folder", async (_: IpcMainInvokeEvent, targetPath: string) => {
    try {
        const resolvedPath = path.resolve(targetPath)
        await fs.promises.mkdir(resolvedPath)
        return { success: true, path: resolvedPath }
    } catch (err: unknown) {
        return { success: false, error: String(err) }
    }
})
ipcMain.handle("reveal-in-file-explorer", async (_: IpcMainInvokeEvent, targetPath: string) => {
    if (!targetPath || typeof targetPath !== "string") {
        return { success: false, error: "Invalid path" }
    }

    shell.showItemInFolder(path.resolve(targetPath))
    return { success: true }
})
ipcMain.handle("rename-path", async (_: IpcMainInvokeEvent, oldPath: string, newPath: string) => {
    async function copyRecursive(src: string, dest: string) {
        const stat = await fs.promises.stat(src);
        if (stat.isDirectory()) {
            await fs.promises.mkdir(dest, { recursive: true });
            const entries = await fs.promises.readdir(src);
            for (const entry of entries) {
                await copyRecursive(path.join(src, entry), path.join(dest, entry));
            }
        } else {
            await fs.promises.copyFile(src, dest);
        }
    }

    const resolvedOldPath = path.resolve(oldPath);
    const resolvedNewPath = path.resolve(newPath);

    try {
        await fs.promises.rename(resolvedOldPath, resolvedNewPath);
        return { success: true, path: resolvedNewPath };
    } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException

        if ((error.code === "EPERM" || error.code === "EACCES") && process.platform === "win32") {
            try {
                await copyRecursive(resolvedOldPath, resolvedNewPath)
                await fs.promises.rm(resolvedOldPath, { recursive: true, force: true })

                return { success: true, path: resolvedNewPath }
            } catch (fallbackErr: unknown) {
                const e = fallbackErr as Error
                return { success: false, error: e.message }
            }
        }

        const e = err as Error
        return { success: false, error: e.message }
    }
})
ipcMain.handle('save-file', async (_: IpcMainInvokeEvent, fullPath: string, content: string) => {
    return await saveFile(fullPath, content);
});
ipcMain.handle('readFileContent', async (_: IpcMainInvokeEvent, filePath: string, encoding = 'utf8') => {
    return readFileContent(filePath, encoding);
});
ipcMain.handle('readDirTree', async (_: IpcMainInvokeEvent, rootPath: string, options = {}) => {
    return readDirTree(rootPath, options);
});
ipcMain.handle("remove-by-path", async (_: IpcMainInvokeEvent, targetPath: string) => {
    try {
        if (!targetPath || typeof targetPath !== "string") {
            throw new Error("Invalid path")
        }

        const resolvedPath = path.resolve(targetPath)

        if (!fs.existsSync(resolvedPath)) {
            return { success: false, error: "Path does not exist" }
        }

        const stat = fs.lstatSync(resolvedPath)

        if (stat.isDirectory()) {
            fs.rmSync(resolvedPath, { recursive: true, force: true })
        } else {
            fs.unlinkSync(resolvedPath)
        }

        return { success: true }
    } catch (err: unknown) {
        return { success: false, error: String(err) }
    }
})
ipcMain.handle('ask-to-save-content', async (_: IpcMainInvokeEvent, payload: SaveContentPayload) => {
    try {
        const result: any = await dialog.showSaveDialog({
            title: 'Save a new file',
            defaultPath: payload.filename,
            buttonLabel: 'Save',
            properties: ['createDirectory']
        });

        if (result.canceled || !result.filePath) {
            return { success: false, canceled: true };
        }

        await fs.promises.writeFile(result.filePath, payload.content, 'utf-8');

        return {
            success: true,
            path: result.filePath
        };

    } catch (err: unknown) {
        console.error('Save error:', err);

        return {
            success: false,
            error: String(err)
        };
    }
});

ipcMain.handle("read-file", async (event: IpcMainInvokeEvent, filePath: string, parentPath: string): Promise<{ success: boolean; result: string | Error }> => {
    try {
        const data = await fs.promises.readFile(
            path.join(parentPath, filePath),
            "utf-8"
        )

        return {
            success: true,
            result: data
        }
    } catch (error) {
        return {
            success: false,
            result: error instanceof Error
                ? error
                : new Error(String(error))
        }
    }
}
)