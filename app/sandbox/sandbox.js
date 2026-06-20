const { app, ipcMain, BrowserWindow } = require("electron")
const fs = require("fs")
const path = require("path")
const bus = require("../../helpers/eventBus.js")
const { APP_PATH } = require("../main/helpers/paths.js")
const ErrorStackParser = require("error-stack-parser")

const { 
    getType, 
    createNativeImageFromUrl,
    checkType,
    ok,
    fail,
    isSafeName,
    stringify,
    saveReadFile,
    isFileExists,
    checkFields,
    createSandboxConsole,
    getArgumentNames
} = require("../sandbox/tools.js")
const { basicMinifyCSS } = require("../../helpers/minify.js")

const vm = require("vm");
const { config } = require("process")

const EXTENSIONS_DIR = path.resolve(
    app.isPackaged ? process.resourcesPath : app.getAppPath(), 
    "extensions"
)

console.log("EXTENSIONS PATH:", EXTENSIONS_DIR)

let debuggerSender = null;
let mainSender = null;

const rendererBus = require("../../assets/js/bus.js")

function parsePackageJson(raw) {
    return JSON.parse(raw.replace(/^\uFEFF/, ""))
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
    const extensionVersion = meta.extensionVersion != undefined ? meta.extensionVersion : null
    const extensionPath = meta.extensionPath != undefined ? meta.extensionPath : null
    const isDev = meta.isDev != undefined ? meta.isDev : false
    const activeOn = meta.activeOn
    const isPackaged = app.isPackaged

    let allCSSVariables = meta.allCSSVariables != undefined ? meta.allCSSVariables : []

    function createAPI(permissions) {
        const app = {
            name: extensionName,
            permissions: permissions,
            version: extensionVersion,
            path: extensionPath,
            isDev: isDev,
            CSSVariables: allCSSVariables,
            isPackaged: isPackaged
        };

        function setNestedProperty(obj, path, value) {
            const parts = path.split(".")

            let current = obj

            for(let i = 0; i < parts.length - 1; i++) {
                const part = parts[i]

                if(!current[part]) {
                    current[part] = {}
                }

                current = current[part]
            }

            current[parts.at(-1)] = value
        }

        permissions.forEach(p => {
            const checkRegex = /^[A-Za-z]+(?:\.[A-Za-z]+)+$/gm

            if(checkRegex.test(p)) {
                let appPermissionFile = p.replaceAll(".", "/")

                if (fs.existsSync(path.join(APP_PATH, "sandbox", "permissions", appPermissionFile + ".js"))) {
                    const { callback } = require(`./permissions/${appPermissionFile}.js`)

                    debuggerSender = debuggerSender ?? mainSender

                    setNestedProperty(app, p, async (...args) => {
                        const factory = callback({
                            debuggerSender,
                            mainSender,
                            extensionName,
                            extensionPath,
                            permissionName: "app." + p,
                            allCSSVariables,
                            selfArgs: args,
                            activeOn: activeOn
                        })

                        if(factory instanceof Promise) {
                            const awaitedFactory = await factory

                            if(typeof awaitedFactory == "function") {
                                return awaitedFactory(...args)
                            }
                        }
                        else if (factory && typeof factory === "function") {
                            return factory(...args);
                        }
                    })
                }
                else {
                    throw new Error(`Permission "${p}" is not exists`)
                }
            }
        })

        function deepFreeze(obj) {
            Object.keys(obj).forEach(key => {
                const val = obj[key]
                if (val && typeof val === "object") {
                    deepFreeze(val)
                }
            })
            return Object.freeze(obj)
        }

        return deepFreeze(app);
    }

    try {
        let app = createAPI(permissions);

        if (typeof code !== "string") {
            return { success: false, error: "Extension code must be a string" }
        }

        if (code.includes('`')) {
            return { success: false, error: "Back-tick characters are not allowed in extension code" }
        }

        const sandbox = {
            console: createSandboxConsole(extensionName, debuggerSender),
            app
        };

        const context = vm.createContext(sandbox);

        const script = new vm.Script(`(async function(){"use strict";${code}})()`);
        await script.runInContext(context, { timeout: 5000 });

        return { success: true };
    } catch (err) {
        const stack = err?.stack || String(err)
        const evalLocation = stack.match(/evalmachine\.<anonymous>:(\d+):(\d+)/)

        let cleanStack = stack
            .split('\n')
            .filter(line => !line.includes('evalmachine.<anonymous>'))
            .join('\n')

        if (!evalLocation) {
            return {
                success: false,
                error: `\n${err?.message || cleanStack}`
            };
        }

        const lineNumber = Number(evalLocation[1])
        const columnNumber = Number(evalLocation[2])
        let message = cleanStack.replaceAll(evalLocation[0], "").split("at")[0].trim()

        message += `\n\tat line: ${lineNumber - 3}`
        message += `\n\tat column: ${columnNumber}`

        return {
            success: false,
            error: message
        };
    }
});