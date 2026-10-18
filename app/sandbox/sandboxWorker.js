const vm = require("vm")

const { parentPort } = require("electron")

const pendingInvokes = new Map()
const callbackRegistry = new Map()

let nextInvokeId = 1
let nextCallbackId = 1
let extensionName = "Unknown"

function formatArg(value) {
    if (typeof value === "string") return value
    if (value instanceof Error) return value.stack || value.message
    if (typeof value === "function") {
        try { return String(value) } catch (e) { return "function" }
    }
    if (value !== null && typeof value === "object") {
        try { return JSON.stringify(value) } catch (e) { return String(value) }
    }
    return String(value)
}

function sanitizeData(value) {
    try { structuredClone(value); return value } catch (e) {}
    try { return JSON.parse(JSON.stringify(value)) } catch (e) {}
    return formatArg(value)
}

function postMessage(message) {
    try {
        parentPort.postMessage(message)
    } catch (e) {
        const fallback = { ...message }
        if (Array.isArray(fallback.args)) {
            fallback.args = fallback.args.map(sanitizeData)
        }
        if ("result" in fallback) {
            fallback.result = sanitizeData(fallback.result)
        }
        parentPort.postMessage(fallback)
    }
}

function sendConsole(level, args) {
    postMessage({
        type: "console",
        level,
        extensionName,
        content: args.map(formatArg).join(", ")
    })
}

function makeConsole() {
    return {
        log: (...args) => sendConsole("log", args),
        warn: (...args) => sendConsole("warn", args),
        error: (...args) => {
            sendConsole("error", args)
            throw new Error(args.map(formatArg).join(", "))
        }
    }
}

function setNestedProperty(obj, propertyPath, value) {
    const parts = propertyPath.split(".")

    let current = obj

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]

        if (!current[part]) {
            current[part] = {}
        }

        current = current[part]
    }

    current[parts.at(-1)] = value
}

function rpcInvoke(permission, args) {
    const id = nextInvokeId++

    return new Promise((resolve, reject) => {
        pendingInvokes.set(id, { resolve, reject })

        postMessage({ type: "invoke", id, permission, args })
    })
}

function createApi(permissions) {
    const app = {}

    permissions.forEach((permission) => {
        if (typeof permission !== "string") return
        if (!/^[A-Za-z]+(?:\.[A-Za-z]+)+$/.test(permission)) return

        setNestedProperty(app, permission, (...args) => {
            const serializedArgs = args.map((arg) => {
                if (typeof arg === "function") {
                    const token = nextCallbackId++
                    callbackRegistry.set(token, arg)
                    return { __extensionCallback: token }
                }
                return sanitizeData(arg)
            })

            return rpcInvoke(permission, serializedArgs)
        })
    })

    return Object.freeze(app)
}

function runExtension(code, permissions, meta) {
    extensionName = meta.extensionName != undefined ? meta.extensionName : "Unknown"

    const context = vm.createContext({
        console: makeConsole(),
        Map: Map,
        app: createApi(permissions),
        JSON: JSON
    })

    return vm.runInContext(`
        (async function(){
            "use strict";
            ${code}
        })()
    `, context)
}

parentPort.on("message", (event) => {
    const message = event.data

    if (!message || typeof message !== "object") return

    if (message.type === "init") {
        Promise.resolve()
            .then(() => runExtension(message.code, message.permissions, message.meta))
            .then(() => parentPort.postMessage({ type: "done", success: true }))
            .catch((err) => {
                const stack = err?.stack || String(err)
                const evalLocation = stack.match(/evalmachine\.<anonymous>:(\d+):(\d+)/)

                if (!evalLocation) {
                    parentPort.postMessage({
                        type: "done",
                        success: false,
                        error: `\n${err?.message || stack}`
                    })
                    return
                }

                parentPort.postMessage({ type: "done", success: false, error: String(err) })
            })
        return
    }

    if (message.type === "callback") {
        const cb = callbackRegistry.get(message.token)

        if (typeof cb === "function") {
            try {
                cb(...(Array.isArray(message.args) ? message.args : []))
            } catch (err) {
                sendConsole("error", [err])
            }
        }
        return
    }

    if (message.type === "result") {
        const pending = pendingInvokes.get(message.id)

        if (!pending) return

        pendingInvokes.delete(message.id)

        if (message.ok) {
            pending.resolve(message.result)
        } else {
            pending.reject(new Error(message.error))
        }
    }
})
