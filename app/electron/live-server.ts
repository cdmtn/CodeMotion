import { ipcMain, shell, IpcMainInvokeEvent } from "electron"
import fs from "fs"
import path from "path"
import http from "http"
import type { FSWatcher } from "chokidar"

const WebSocket = require("ws")
const chokidar = require("chokidar")

let liveServer: http.Server | null = null
let wss: any = null
let watcher: FSWatcher | null = null

ipcMain.handle("start-live-server", async (_event: IpcMainInvokeEvent, htmlPath: string) => {
    if (!fs.existsSync(htmlPath)) {
        return { error: "HTML file not found" }
    }

    if (liveServer) {
        return { error: "Live server already running" }
    }

    const root = path.resolve(path.dirname(htmlPath))
    const port = 3000
    const wsPort = 3001

    function inject(html: string): string {
        const script = `
        <script>
            const ws = new WebSocket("ws://localhost:${wsPort}")
            ws.onmessage = () => location.reload()
        </script>
        `
        return html.replace("</body>", script + "</body>")
    }

    liveServer = http.createServer((req, res) => {
        let pathname: string
        try {
            pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname)
        } catch {
            res.writeHead(400)
            return res.end("Bad request")
        }

        if (pathname === "/") pathname = "/" + path.basename(htmlPath)

        const filePath = path.resolve(root, "." + pathname)
        if (filePath !== root && !filePath.startsWith(root + path.sep)) {
            res.writeHead(403)
            return res.end("Forbidden")
        }

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404)
                return res.end("Not found")
            }

            let payload: string | Buffer = data
            if (filePath.endsWith(".html")) {
                payload = inject(data.toString())
            }

            res.writeHead(200)
            res.end(payload)
        })
    })

    liveServer.listen(port)

    wss = new WebSocket.Server({ port: wsPort })

    watcher = chokidar.watch(root).on("change", () => {
        wss.clients.forEach((client: any) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send("reload")
            }
        })
    })

    const url = `http://localhost:${port}`

    shell.openExternal(url)

    return {
        success: true,
        url
    }
})

ipcMain.handle("stop-live-server", async () => {
    if (!liveServer) {
        return { error: "Live server not running" }
    }

    try {
        if (watcher) {
            await watcher.close()
            watcher = null
        }

        if (wss) {
            wss.close()
            wss = null
        }

        liveServer.close()
        liveServer = null

        return {
            success: true
        }
    } catch (err) {
        return {
            error: err instanceof Error ? err.message : String(err)
        }
    }
})
