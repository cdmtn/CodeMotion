const net = require("net")
const os = require("os")

const clients = new Map()

function callback(data) {
    const input = data.selfArgs[0]
    const extensionName = data.extensionName
    const debuggerSender = data.debuggerSender

    if (input === "clear") {
        return getClient(extensionName, {}, debuggerSender).clear()
    }

    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("[APP.richPresence] First argument must be a presence object or \"clear\"")
    }

    const provider = input.provider || "discord"

    if (provider !== "discord") {
        throw new Error(`[APP.richPresence] Unsupported provider "${provider}"`)
    }

    if (typeof input.clientId !== "string" || input.clientId.trim() === "") {
        throw new Error("[APP.richPresence] Discord provider requires a clientId string")
    }

    return getClient(extensionName, input, debuggerSender).setActivity(input)
}

function getClient(extensionName, options, debuggerSender) {
    const key = `${extensionName}:discord`

    if (!clients.has(key)) {
        clients.set(key, new DiscordPresenceClient({
            extensionName,
            clientId: options.clientId,
            debuggerSender
        }))
    }

    const client = clients.get(key)

    if (options.clientId) {
        client.clientId = options.clientId
    }

    return client
}

class DiscordPresenceClient {
    constructor({ extensionName, clientId, debuggerSender }) {
        this.extensionName = extensionName
        this.clientId = clientId
        this.debuggerSender = debuggerSender
        this.socket = null
        this.connected = false
        this.connecting = false
        this.pendingActivity = null
    }

    async setActivity(input) {
        this.pendingActivity = this.#toDiscordActivity(input)

        await this.#connect()

        if (!this.connected) return false

        this.#send(1, {
            cmd: "SET_ACTIVITY",
            args: {
                pid: process.pid,
                activity: this.pendingActivity
            },
            nonce: this.#nonce()
        })

        return true
    }

    async clear() {
        await this.#connect()

        if (!this.connected) return false

        this.#send(1, {
            cmd: "SET_ACTIVITY",
            args: {
                pid: process.pid
            },
            nonce: this.#nonce()
        })

        return true
    }

    async #connect() {
        if (this.connected || this.connecting) return

        this.connecting = true

        for (const pipePath of getDiscordPipePaths()) {
            const connected = await this.#tryConnect(pipePath)

            if (connected) {
                this.connecting = false
                this.connected = true
                this.#send(0, { v: 1, client_id: this.clientId })
                return
            }
        }

        this.connecting = false
        this.#log("warn", "Discord IPC pipe was not found. Is Discord running?")
    }

    #tryConnect(pipePath) {
        return new Promise((resolve) => {
            const socket = net.createConnection(pipePath)
            let settled = false

            const done = (success) => {
                if (settled) return

                settled = true
                socket.removeAllListeners("connect")
                socket.removeAllListeners("error")
                resolve(success)
            }

            socket.once("connect", () => {
                this.socket = socket
                socket.on("error", (error) => this.#handleDisconnect(error))
                socket.on("close", () => this.#handleDisconnect())
                done(true)
            })

            socket.once("error", () => done(false))
        })
    }

    #handleDisconnect(error) {
        if (error) {
            this.#log("warn", `Discord presence disconnected: ${error.message}`)
        }

        this.connected = false
        this.socket = null
    }

    #send(opcode, payload) {
        if (!this.socket) return

        const json = Buffer.from(JSON.stringify(payload))
        const frame = Buffer.alloc(8 + json.length)

        frame.writeInt32LE(opcode, 0)
        frame.writeInt32LE(json.length, 4)
        json.copy(frame, 8)

        this.socket.write(frame)
    }

    #toDiscordActivity(input) {
        const activity = {
            details: input.details || "Editing code",
            state: input.state || "In CodeMotion"
        }

        if (Number.isFinite(Number(input.startTimestamp))) {
            activity.timestamps = { start: Number(input.startTimestamp) }
        }
        if (input.largeImageKey || input.largeImageText || input.smallImageKey || input.smallImageText) {
            activity.assets = {}

            if (input.largeImageKey) activity.assets.large_image = String(input.largeImageKey)
            if (input.largeImageText) activity.assets.large_text = String(input.largeImageText)
            if (input.smallImageKey) activity.assets.small_image = String(input.smallImageKey)
            if (input.smallImageText) activity.assets.small_text = String(input.smallImageText)
        }
        if (Array.isArray(input.buttons) && input.buttons.length > 0) {
            activity.buttons = input.buttons
                .slice(0, 2)
                .filter(button => button && typeof button.label === "string" && typeof button.url === "string")
                .map(button => ({ label: button.label, url: button.url }))
        }

        return activity
    }

    #nonce() {
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`
    }

    #log(type, content) {
        this.debuggerSender?.send("debug-event", {
            data: {
                type,
                content,
                from: this.extensionName
            },
            time: Date.now()
        })
    }
}

function getDiscordPipePaths() {
    const paths = []

    for (let index = 0; index < 10; index++) {
        if (process.platform === "win32") {
            paths.push(`\\\\?\\pipe\\discord-ipc-${index}`)
        } else {
            const runtimeDir = process.env.XDG_RUNTIME_DIR || os.tmpdir()

            paths.push(`${runtimeDir}/discord-ipc-${index}`)
            paths.push(`/tmp/discord-ipc-${index}`)
        }
    }

    return paths
}

module.exports = { callback }
