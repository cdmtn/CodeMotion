import { ipcMain, shell, IpcMainInvokeEvent } from "electron"
import fs from "fs"
import path from "path"
import http from "http"
import type { FSWatcher } from "chokidar"

const WebSocket = require("ws")
const chokidar = require("chokidar")

const MIME_TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".cjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".eot": "application/vnd.ms-fontobject",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".wasm": "application/wasm",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg"
}

function contentType(filePath: string): string {
    return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream"
}

function listen(server: http.Server, startPort: number, attempts = 20): Promise<number> {
    return new Promise((resolve, reject) => {
        let port = startPort
        let tries = 0

        const attempt = () => {
            const onError = (err: NodeJS.ErrnoException) => {
                if (err.code === "EADDRINUSE" && tries < attempts) {
                    tries++
                    port++
                    attempt()
                } else {
                    reject(err)
                }
            }

            server.once("error", onError)
            server.listen(port, () => {
                server.removeListener("error", onError)
                resolve(port)
            })
        }

        attempt()
    })
}

function createWss(startPort: number, attempts = 20): Promise<{ wss: any; port: number }> {
    return new Promise((resolve, reject) => {
        let port = startPort
        let tries = 0

        const attempt = () => {
            const server = new WebSocket.Server({ port })

            const onError = (err: NodeJS.ErrnoException) => {
                if (err.code === "EADDRINUSE" && tries < attempts) {
                    tries++
                    port++
                    attempt()
                } else {
                    reject(err)
                }
            }

            server.once("error", onError)
            server.once("listening", () => {
                server.removeListener("error", onError)
                resolve({ wss: server, port })
            })
        }

        attempt()
    })
}

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
    let wsPort = 0

    function inject(html: string): string {
        const script = `
        <script>
            const ws = new WebSocket("ws://localhost:${wsPort}")
            ws.onmessage = () => location.reload()
        </script>
        `
        return html.includes("</body>")
            ? html.replace("</body>", script + "</body>")
            : html + script
    }

    const server = http.createServer((req, res) => {
        let pathname: string
        try {
            pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname)
        } catch {
            res.writeHead(400)
            return res.end("Bad request")
        }

        if (pathname === "/") pathname = "/" + path.basename(htmlPath)

        let filePath = path.resolve(root, "." + pathname)
        if (filePath !== root && !filePath.startsWith(root + path.sep)) {
            res.writeHead(403)
            return res.end("Forbidden")
        }

        fs.stat(filePath, (statErr, stats) => {
            if (!statErr && stats.isDirectory()) {
                filePath = path.join(filePath, "index.html")
            }

            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404)
                    return res.end("Not found")
                }

                const type = contentType(filePath)

                if (type.startsWith("text/html")) {
                    res.writeHead(200, { "Content-Type": type })
                    return res.end(inject(data.toString()))
                }

                res.writeHead(200, { "Content-Type": type })
                res.end(data)
            })
        })
    })

    let httpPort: number
    try {
        httpPort = await listen(server, 3000)
        const ws = await createWss(httpPort + 1)
        wsPort = ws.port
        wss = ws.wss
    } catch (err) {
        server.close()
        return { error: err instanceof Error ? err.message : String(err) }
    }

    liveServer = server

    watcher = chokidar
        .watch(root, { ignoreInitial: true, ignored: /(^|[\\/])(node_modules|\.git)([\\/]|$)/ })
        .on("change", () => {
            wss.clients.forEach((client: any) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send("reload")
                }
            })
        })

    const url = `http://localhost:${httpPort}`

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
