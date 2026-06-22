const { ipcMain, shell } = require("electron")
const fs = require("fs")
const path = require("path")
const http = require("http")
const WebSocket = require("ws")
const chokidar = require("chokidar")

let liveServer = null
let wss = null
let watcher = null

ipcMain.handle("start-live-server", async (event, htmlPath) => {
    if (!fs.existsSync(htmlPath)) {
        return { error: "HTML file not found" }
    }

    if (liveServer) {
        return { error: "Live server already running" }
    }

    const root = path.dirname(htmlPath)

    function getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase()
        const map = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.otf': 'font/otf'
        }
        return map[ext] || 'application/octet-stream'
    }

    function inject(html) {
        const script = `
        <script>
            const ws = new WebSocket("ws://localhost:${3001}")
            ws.onmessage = () => location.reload()
        </script>
        `
        return html.replace(/<\/body>/i, script + "</body>")
    }

    liveServer = http.createServer((req, res) => {

        let filePath = path.join(root, req.url === "/" ? path.basename(htmlPath) : req.url)
        const resolvedFile = path.resolve(filePath)
        const resolvedRoot = path.resolve(root)
        if (!resolvedFile.startsWith(resolvedRoot + path.sep)) {
            res.writeHead(403)
            return res.end("Forbidden")
        }

        fs.readFile(filePath, (err, data) => {

            if (err) {
                res.writeHead(404)
                return res.end("Not found")
            }

            if (filePath.endsWith(".html")) {
                data = inject(data.toString())
            }

            res.writeHead(200, { 'Content-Type': getMimeType(filePath) })
            res.end(data)

        })
    })

    let port = 3000
    let wsPort = 3001
    return new Promise((resolve) => {
        function tryListen(attempt = 0) {
            liveServer.listen(port, () => {
                const addr = liveServer.address()
                if (addr && typeof addr === 'object') {
                    port = addr.port
                    wsPort = port + 1
                }

                const wsServer = http.createServer()
                wss = new WebSocket.Server({ server: wsServer })
                wsServer.listen(wsPort)

                watcher = chokidar.watch(root).on("change", () => {
                    wss.clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send("reload")
                        }
                    })
                })

                const url = `http://localhost:${port}`
                shell.openExternal(url)
                resolve({ success: true, url })
            })
            liveServer.on("error", (err) => {
                if (err.code === "EADDRINUSE" && attempt < 10) {
                    port++
                    wsPort++
                    tryListen(attempt + 1)
                } else {
                    console.error("[Live Server] Failed to start:", err)
                    resolve({ error: err.message })
                }
            })
        }
        tryListen()
    })
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
            error: err.message
        }
    }
})