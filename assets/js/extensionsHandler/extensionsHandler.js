import { createNotify, getAllCSSVariables, normalizePath } from "../lib.js"
import { sendDebugMsg, sendDebugError, sendDebugWarn, sendDebugModuleInfo, sendDebugMarking } from "../handlers/debuggerSignalHandlers.js"
import { handleExtensionEvents } from "./extensionEventsHandler.js"
import { Modal } from "../modalsHandler/engine.js"
import { bus } from "../bus.js"

const installedExtensionModalData = []

function checkPackage(object) {
    if (!object || Object.keys(object).length === 0) {
        return { success: false, msg: "File missing or empty" }
    }

    const requireFields = ["version", "name", "displayName", "main", "permissions", "description", "activeOn"]

    for (const f of requireFields) {
        if (!(f in object)) {
            return { success: false, msg: `Missing field: ${f}` }
        }
    }

    return { success: true, msg: "All fine" }
}

function checkModulePackage(object) {
    if (!object || Object.keys(object).length === 0) {
        return { success: false, msg: "File missing or empty" }
    }

    const requireFields = ["version", "name", "displayName", "description", "main", "permissions"]

    for (const f of requireFields) {
        if (!(f in object)) {
            return { success: false, msg: `Missing field: ${f}` }
        }
    }

    return { success: true, msg: "All fine" }
}

function notifyError({ name, content }) {
    createNotify({
        type: "danger",
        icon: "error",
        title: `Extension "${name}" have errors. Check Debugger for more info`,
        content: content
    })
}

export async function initExtensions() {
    handleExtensionEvents()

    const extensionsRequest = await window.electron.requestExtensions()

    if (!extensionsRequest.success) return

    const names = extensionsRequest.result
    const settings = await window.electron.readSettings()

    // PROCEED EACH EXT
    for (const name of names) {
        const extensionRequest = await window.electron.requestExtension(name)

        if (!extensionRequest.success) {
            notifyError({ name: name, content: extensionRequest.result })
            sendDebugError(`(Extension) ${name}: load error. ${extensionRequest.result}`)
            continue
        }

        let extensionFinalContent = ""
        let allPermissions = new Set()

        let extensionPackage = extensionRequest.result.package
        let extensionPath = extensionRequest.result.path
        let extensionPackageCheck = checkPackage(extensionPackage)

        if (!extensionPackageCheck.success) {
            notifyError({ name: name, content: extensionPackageCheck.msg })
            sendDebugError(`(Extension) ${name}: package.json error. ${extensionPackageCheck.msg}`)
            continue
        }

        let version = extensionPackage.version
        let icon = extensionPackage.icon != undefined ? extensionPackage.icon : false
        let description = extensionPackage.description
        let displayName = extensionPackage.displayName
        let main = extensionPackage.main
        let permissions = extensionPackage.permissions || []
        let activeOn = extensionPackage.activeOn

        permissions.forEach(p => allPermissions.add(p))

        const permissionsArray = [...allPermissions]
        
        let isDev = false

        if ("app" in settings && "devMode" in settings.app) {
            isDev = settings.app.devMode
        }

        // add extension to the list

        installedExtensionModalData.push(
            createInstalledExtensionsModalTemplate({
                title: displayName,
                subtitle: `${name} (${version})`,
                description: description,
                image: icon ? `${normalizePath(extensionPath)}/${icon}` : name,
                permissions: allPermissions,
                path: extensionPath
            })
        )

        if(!Array.isArray(activeOn)) {
            sendDebugError(`${name}: activeOn key in package.json must be array`)
            return
        }

        let extensionMainFileContentRes = await window.electron.readFile(`/extensions/${name}/${main}.js`)

        if (!extensionMainFileContentRes.success) {
            notifyError({ name: displayName, content: extensionMainFileContentRes.result })
            return
        }

        sendDebugMarking()
        sendDebugMsg(`${name}: package.json loaded successfully\nPermissions: ${permissions.length > 0 ? permissions.join(", ") : "none"}`)
        sendDebugMsg(`${name}: ${main}.js loaded`)

        createNotify({
            type: "success",
            icon: "check",
            title: `Extension "${displayName}" successfully added`,
            content: `Version: ${version}`
        })

        // register providers in package.json

        if("language.register" in extensionPackage) {
            const languageRegisterConfig = extensionPackage["language.register"]

            if(languageRegisterConfig.length > 0) {
                window.electron.ext.editor.language.register(
                    {
                        configPath: languageRegisterConfig,
                        extensionPath: normalizePath(extensionPath),
                        extensionName: name
                    }
                )
            }
        }
        if("docs.register" in extensionPackage) {
            const docsRegisterConfig = extensionPackage["docs.register"]

            if(docsRegisterConfig.length > 0) {
                window.electron.ext.editor.docs.register(
                    {
                        configPath: docsRegisterConfig,
                        extensionPath: normalizePath(extensionPath),
                        extensionName: name
                    }
                )
            }
        }
        
        // 
        
        // activation events
        const activeOnEvents = {
            load: () => true,

            language: (name, onActivate) => {
                const handler = (data) => {
                    const mode = data.detail.editor.session.$modeId.split("ace/mode/")[1]

                    if (mode === name) {
                        onActivate()
                    }
                }

                bus.addEventListener("file-opened-event", handler)

                return () => {
                    bus.removeEventListener("file-opened-event", handler)
                }
            }
        }

        activeOn.forEach(event => {
            const [eventName, ...args] = event.split(":").map(s => s.trim())

            if (eventName === "load") {
                runExtension()
            }

            if (eventName === "language") {
                activeOnEvents.language(args[0], () => {
                    runExtension()
                })
            }
        })
        // 
        
        async function runExtension() {
            const runResult = await window.electron.runExtension(
                extensionMainFileContentRes.result,
                permissionsArray,
                {
                    extensionName: name,
                    extensionVersion: version,
                    extensionPath: extensionPath,
                    isDev: isDev,
                    allCSSVariables: getAllCSSVariables(),
                    activeOn: activeOn
                }
            )

            sendDebugMarking()
            sendDebugWarn(`Currently, the "${name}" extension and all modules connected to it use special permissions: <b>${permissionsArray.join(", ")}</b>`)

            if (!runResult.success) {
                sendDebugError(`${name}: runtime error: ${runResult.error}`)
            }
        }
    }

    const installedExtensionsModal = Modal.create({
        id: "installedExtensions",
        name: "Installed Extensions",
        modalClassList: ["window"],
        title: "Installed extensions",

        content: [
            {
                type: "row",
                classList: ["background"],
                items: installedExtensionModalData
            },
        ]
    })

    installedExtensionsModal.bind(document.querySelector("#extensionsAll"))
}

function createInstalledExtensionsModalTemplate({ title, subtitle, description, image, permissions, path }) {
    const tags = []

    for (const p of permissions) {
        tags.push({
            type: "permission",
            name: p
        })
    }

    const template = {
        type: "extensionItem",
        title: title,
        subtitle: subtitle,
        description: description,
        image: image,
        tags: tags,
        buttons: [
            {
                icon: "delete",
                onclick: (data) => {
                    data.element.remove()
                    window.electron.removeByPath(path)
                }
            }
        ]
    }

    return template
}