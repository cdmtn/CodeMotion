import { ipcMain, IpcMainEvent } from "electron"

const chokidar = require("chokidar")

let watcher: any = null

function stop(): void {
    if (watcher) {
        try {
            watcher.close()
        } catch {
        }
        watcher = null
    }
}

ipcMain.on("watch-folder", (event: IpcMainEvent, rootPath: string) => {
    stop()

    if (!rootPath || typeof rootPath !== "string") return

    watcher = chokidar.watch(rootPath, {
        ignoreInitial: true,
        ignorePermissionErrors: true,
        ignored: /(^|[\\/])(node_modules|\.git|\.hg|\.svn|dist|dist-esm)([\\/]|$)/,
        depth: 24
    })

    const send = (type: string, changedPath: string) => {
        if (!event.sender.isDestroyed()) {
            event.sender.send("explorer-fs-change", { type, path: changedPath })
        }
    }

    watcher
        .on("add", (p: string) => send("add", p))
        .on("unlink", (p: string) => send("unlink", p))
        .on("addDir", (p: string) => send("addDir", p))
        .on("unlinkDir", (p: string) => send("unlinkDir", p))
})

ipcMain.on("unwatch-folder", () => stop())
