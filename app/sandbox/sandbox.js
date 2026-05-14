const { app, ipcMain, BrowserWindow } = require("electron")
const fs = require("fs")
const path = require("path")
const bus = require("../../helpers/eventBus.js")
const { APP_PATH } = require("../helpers/paths.js")
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

const EXTENSIONS_DIR = path.resolve(app.getAppPath(), "extensions")
const EXTENSIONS_MODULES_DIR = path.resolve(app.getAppPath(), "extension_modules")

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

ipcMain.handle("load-module", async (event, name, version) => {
    try {
        if (!isSafeName(name) || !isSafeName(version)) {
            return fail("Invalid name or version")
        }

        if (!fs.existsSync(EXTENSIONS_MODULES_DIR)) {
            return fail("Modules directory does not exist")
        }

        const modulePath = path.join(EXTENSIONS_MODULES_DIR, name)

        if (!fs.existsSync(modulePath)) {
            return fail("Module not found")
        }

        const moduleStat = await fs.promises.stat(modulePath)
        if (!moduleStat.isDirectory()) {
            return fail("Module path is not a directory")
        }

        const versionPath = path.join(modulePath, version)

        if (!fs.existsSync(versionPath)) {
            return fail("Version not found")
        }

        const versionStat = await fs.promises.stat(versionPath)
        if (!versionStat.isDirectory()) {
            return fail("Version path is not a directory")
        }

        const packagePath = path.join(versionPath, "package.json")

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

        return ok(json)

    } catch (err) {
        return fail(err)
    }
})

ipcMain.handle("run-extension", async (event, code, permissions, meta) => {
    const extensionName = meta.extensionName != undefined ? meta.extensionName : "Unknown"
    const extensionVersion = meta.extensionVersion != undefined ? meta.extensionVersion : null
    const extensionPath = meta.extensionPath != undefined ? meta.extensionPath : null
    const isDev = meta.isDev != undefined ? meta.isDev : false
    let allCSSVariables = meta.allCSSVariables != undefined ? meta.allCSSVariables : []

    function createAPI(permissions) {
        const APP = {
            name: extensionName,
            permissions: permissions,
            version: extensionVersion,
            path: extensionPath,
            isDev: isDev,
            CSSVariables: allCSSVariables
        };

        permissions.forEach(p => {
            if(p.startsWith("app.")) {
                let appPermissionName = p.split("app.")[1].trim()

                if (fs.existsSync(path.join(APP_PATH, "sandbox", "permissions", appPermissionName + ".js"))) {
                    const { callback } = require(`./permissions/${appPermissionName}.js`)

                    debuggerSender = debuggerSender ?? mainSender

                    APP[appPermissionName] = (...args) => {
                        return callback(
                            {
                                debuggerSender: debuggerSender,
                                mainSender: mainSender,
                                extensionName: extensionName,
                                extensionPath: extensionPath,
                                allCSSVariables: allCSSVariables,
                                selfArgs: args
                            }
                        )
                    }
                }
                else {
                    throw new Error(`Permission "app.${appPermissionName}" is not exists`)
                }
            }
        })

        return Object.freeze(APP);
    }

    try {
        let APP = createAPI(permissions);

        const sandbox = {
            console: console,
            Map: Map,
            APP
        };

        const context = vm.createContext(sandbox);

        await vm.runInContext(`
            (function(){
                "use strict";
                ${code}
            })()
        `, context);

        return { success: true };
    } catch (err) {
        const stack = err?.stack || String(err)
        const evalLocation = stack.match(/evalmachine\.<anonymous>:(\d+):(\d+)/)

        if (!evalLocation) {
            return {
                success: false,
                error: `\n${err?.message || stack}`
            };
        }

        const lineNumber = Number(evalLocation[1])
        const columnNumber = Number(evalLocation[2])
        let message = stack.replaceAll(evalLocation[0], "").split("at")[0].trim()

        message += `\n\tat line: ${lineNumber - 3}`
        message += `\n\tat column: ${columnNumber}`

        return { 
            success: false,
            error: `\n${message}`
        };
    }
});