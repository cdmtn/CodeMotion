const { app, ipcMain, utilityProcess } = require("electron")
const fs = require("fs")
const path = require("path")
const bus = require("../../helpers/eventBus.js")
const { APP_PATH } = require("../dist/helpers/paths.js")
const ErrorStackParser = require("error-stack-parser")

const {
    createSandboxConsole,
    isSafeName,
    ok,
    fail
} = require("../sandbox/tools.js")
const { basicMinifyCSS } = require("../../helpers/minify.js")
const { buildSafeEnv } = require("./permissions/shell/_common.js")

const { config } = require("process")

const EXTENSIONS_DIR = path.resolve(
    app.isPackaged ? process.resourcesPath : app.getAppPath(),
    "extensions"
)

const WORKER_PATH = path.join(__dirname, "sandboxWorker.js")

const PERMISSION_REGEX = /^[A-Za-z]+(?:\.[A-Za-z]+)+$/

console.log("EXTENSIONS PATH:", EXTENSIONS_DIR)

let debuggerSender = null;
let mainSender = null;

const rendererBus = require("../../assets/js/bus.js")

const extensionWorkers = new Map()

function parsePackageJson(raw) {
    if (raw.charCodeAt(0) === 0xFEFF) {
        raw = raw.slice(1)
    }
    return JSON.parse(raw)
}

function sanitizeData(value) {
    try { structuredClone(value); return value } catch (e) {}
    try { return JSON.parse(JSON.stringify(value)) } catch (e) {}
    return String(value)
}

function sendToWorker(entry, message) {
    try {
        entry.child.postMessage(message)
    } catch (e) {}
}

function terminateWorker(entry) {
    if (!entry) return

    extensionWorkers.delete(entry.extensionName)

    try {
        entry.child.kill()
    } catch (e) {}
}

function forwardSandboxConsole(level, content, name) {
    const sender = debuggerSender ?? mainSender
    if (!sender) return

    try {
        const sandboxConsole = createSandboxConsole(name, sender)

        if (level === "error") {
            try { sandboxConsole.error(content) } catch (e) {}
        } else if (level === "warn") {
            sandboxConsole.warn(content)
        } else {
            sandboxConsole.log(content)
        }
    } catch (e) {}
}

async function handlePermissionInvoke(entry, message) {
    const reply = (response) => sendToWorker(entry, { type: "result", id: message.id, ...response })

    try {
        const permission = message.permission

        if (typeof permission !== "string" || !PERMISSION_REGEX.test(permission)) {
            throw new Error(`Permission "${String(permission)}" is not exists`)
        }

        const permissionFile = path.join(
            APP_PATH,
            "sandbox",
            "permissions",
            permission.replaceAll(".", "/") + ".js"
        )

        if (!fs.existsSync(permissionFile)) {
            throw new Error(`Permission "${permission}" is not exists`)
        }

        const { callback } = require(permissionFile)

        const rawArgs = Array.isArray(message.args) ? message.args : []

        const realArgs = rawArgs.map((arg) => {
            if (arg !== null && typeof arg === "object" && Number.isInteger(arg.__extensionCallback)) {
                const token = arg.__extensionCallback

                return (...cbArgs) => {
                    sendToWorker(entry, {
                        type: "callback",
                        token,
                        args: cbArgs.map(sanitizeData)
                    })
                }
            }

            return arg
        })

        debuggerSender = debuggerSender ?? mainSender

        const factory = await callback({
            debuggerSender,
            mainSender,
            extensionName: entry.extensionName,
            extensionPath: entry.meta.extensionPath,
            permissionName: "app." + permission,
            allCSSVariables: entry.meta.allCSSVariables,
            selfArgs: realArgs,
            activeOn: entry.meta.activeOn
        })

        let result
        if (typeof factory === "function") {
            result = await factory(...realArgs)
        }

        reply({ ok: true, result: sanitizeData(result) })
    } catch (err) {
        reply({ ok: false, error: err?.message || String(err) })
    }
}

bus.on("debugger-ready", (sender) => {
    debuggerSender = sender;
    console.log("ExtensionManager: debugger connected");
});
bus.on("main-ready", (sender) => {
    mainSender = sender;
    console.log("ExtensionManager: main connected");
});

ipcMain.handle("get-extensions-dir", () => {
    return EXTENSIONS_DIR
})

ipcMain.handle("request-extensions", async () => {
    try {
        if (!fs.existsSync(EXTENSIONS_DIR)) {
            return fail("Extensions directory does not exist")
        }

        const files = await fs.promises.readdir(EXTENSIONS_DIR, { withFileTypes: true })

        const dirs = files
            .filter(f => f.isDirectory())
            .map(f => f.name)

        return ok(dirs)

    } catch (err) {
        return fail(err)
    }
})

ipcMain.handle("request-extension", async (event, name) => {
    try {
        if (!isSafeName(name)) {
            return fail("Invalid extension name")
        }

        const extPath = path.join(EXTENSIONS_DIR, name)

        if (!fs.existsSync(extPath)) {
            return fail("Extension not found")
        }

        const stat = await fs.promises.stat(extPath)

        if (!stat.isDirectory()) {
            return fail("Extension is not a directory")
        }

        const packagePath = path.join(extPath, "package.json")

        if (!fs.existsSync(packagePath)) {
            return fail("package.json not found")
        }

        const raw = await fs.promises.readFile(packagePath, "utf-8")

        let json
        try {
            json = parsePackageJson(raw)
        } catch {
            return fail("Invalid JSON in package.json")
        }

        return ok({ package: json, path: extPath })

    } catch (err) {
        return fail(err)
    }
})

ipcMain.handle("run-extension", async (event, code, permissions, meta) => {
    const extensionName = meta.extensionName != undefined ? meta.extensionName : "Unknown"
    const extensionDisplayName = meta.extensionDisplayName != undefined ? meta.extensionDisplayName : "Unknown"
    const extensionVersion = meta.extensionVersion != undefined ? meta.extensionVersion : null
    const extensionPath = meta.extensionPath != undefined ? meta.extensionPath : null
    const isDev = meta.isDev != undefined ? meta.isDev : false
    const activeOn = meta.activeOn
    const isPackaged = app.isPackaged
    const extensionSettings = meta.extensionSettings || {}
    const allCSSVariables = meta.allCSSVariables != undefined ? meta.allCSSVariables : []

    if (typeof code !== "string" || code.length === 0) {
        return { success: false, error: "\nExtension code must be a non-empty string" }
    }

    const permissionList = Array.isArray(permissions) ? permissions : []

    for (const permission of permissionList) {
        if (typeof permission !== "string" || !PERMISSION_REGEX.test(permission)) {
            return { success: false, error: `\nInvalid permission "${String(permission)}"` }
        }
    }

    terminateWorker(extensionWorkers.get(extensionName))

    let child

    try {
        child = utilityProcess.fork(WORKER_PATH, [], {
            serviceName: `codemotion-extension-${extensionName}`,
            sandbox: false,
            env: buildSafeEnv()
        })
    } catch (err) {
        return { success: false, error: `\n${err?.message || String(err)}` }
    }

    return new Promise((resolve) => {
        const entry = {
            extensionName,
            child,
            meta: { extensionPath, activeOn, allCSSVariables },
            settled: false
        }

        extensionWorkers.set(extensionName, entry)

        const finish = (result) => {
            if (entry.settled) return
            entry.settled = true
            resolve(result)
        }

        child.on("exit", (exitCode) => {
            terminateWorker(entry)
            finish({ success: false, error: `\nExtension worker exited unexpectedly (code ${exitCode})` })
        })

        child.on("message", (message) => {
            if (!message || typeof message !== "object") return

            if (message.type === "console") {
                forwardSandboxConsole(
                    message.level,
                    message.content,
                    message.extensionName || extensionName
                )
                return
            }

            if (message.type === "done") {
                finish(message.success
                    ? { success: true }
                    : { success: false, error: message.error })
                return
            }

            if (message.type === "invoke") {
                handlePermissionInvoke(entry, message)
            }
        })

        child.postMessage({
            type: "init",
            code,
            permissions: permissionList,
            meta: {
                extensionName,
                extensionDisplayName,
                extensionVersion,
                extensionPath,
                isDev,
                activeOn,
                isPackaged,
                extensionSettings,
                allCSSVariables
            }
        })
    })
});
