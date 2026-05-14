import { createNotify, getAllCSSVariables, normalizePath } from "../lib.js"
import { sendDebugMsg, sendDebugError, sendDebugWarn, sendDebugModuleInfo, sendDebugMarking } from "../handlers/debuggerSignalHandlers.js"
import { handleExtensionEvents } from "./extensionEventsHandler.js"
import { Modal } from "../modalsHandler/engine.js"

const installedExtensionModalData = []

function checkPackage(object) {
    if (!object || Object.keys(object).length === 0) {
        return { success: false, msg: "File missing or empty" }
    }

    const requireFields = ["version", "name", "displayName", "execFile", "dependencies", "permissions", "description"]

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

    const requireFields = ["version", "name", "displayName", "description", "execFile", "permissions"]

    for (const f of requireFields) {
        if (!(f in object)) {
            return { success: false, msg: `Missing field: ${f}` }
        }
    }

    return { success: true, msg: "All fine" }
}

function notifyError({ name, content }) {
    createNotify({
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

        sendDebugMarking()

        let version = extensionPackage.version
        let icon = extensionPackage.icon != undefined ? extensionPackage.icon : false
        let description = extensionPackage.description
        let displayName = extensionPackage.displayName
        let execFile = extensionPackage.execFile
        let dependencies = extensionPackage.dependencies || {}
        let permissions = extensionPackage.permissions || []

        sendDebugMsg(`(Extension) ${name}: package.json loaded successfully\nPermissions: ${permissions.length > 0 ? permissions.join(", ") : "none"}`)

        permissions.forEach(p => allPermissions.add(p))

        let extensionExecFileContent = await window.electron.readFile(`/extensions/${name}/${execFile}.js`)

        if (!extensionExecFileContent.success) {
            notifyError({ name: displayName, content: extensionExecFileContent.result })
            continue
        }

        sendDebugMsg(`(Extension) ${name}: ${execFile}.js loaded`)

        extensionExecFileContent = extensionExecFileContent.result

        createNotify({
            icon: "check",
            title: `Extension "${displayName}" successfully loaded`,
            content: `Version: ${version}`
        })

        // MODULE LOAD
        for (const depName of Object.keys(dependencies)) {
            const depVersion = dependencies[depName]

            const depRequest = await window.electron.loadExtensionModule(depName, depVersion)

            if (!depRequest.success) {
                sendDebugError(`(Extension) ${name}: Module "${depName}" (v${depVersion}) failed to load. ${depRequest.result}`)
                continue
            }

            const depPackage = depRequest.result
            const depPackageCheck = checkModulePackage(depPackage)

            if (!depPackageCheck.success) {
                sendDebugError(`(Extension) ${name}: Module "${depName}" (v${depVersion}) package.json error. ${depPackageCheck.msg}`)
                continue
            }

            const {
                name: moduleName,
                version: moduleVersion,
                description: moduleDescription,
                execFile: moduleExecFile,
                permissions: modulePermissions = []
            } = depPackage

            modulePermissions.forEach(p => allPermissions.add(p))

            let moduleExecFileContent = await window.electron.readFile(`/extension_modules/${depName}/${moduleVersion}/${moduleExecFile}.js`)

            if (!moduleExecFileContent.success) {
                sendDebugError(`(Extension) ${name}: Module "${depName}" (v${depVersion}) execFile "${moduleExecFile}.js" failed to load. ${moduleExecFileContent.result}`)
                continue
            }

            moduleExecFileContent = moduleExecFileContent.result

            sendDebugMsg(`(Extension) ${name}: Loaded module "${depName}" (v${moduleVersion})\nPermissions: ${modulePermissions.join(", ")}`)
            sendDebugModuleInfo({
                name: moduleName,
                version: moduleVersion,
                description: moduleDescription,
                permissions: modulePermissions
            })

            extensionFinalContent += moduleExecFileContent + "\n"
        }

        extensionFinalContent += extensionExecFileContent

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
                dependencies: dependencies,
                permissions: allPermissions,
                path: extensionPath
            })
        )

        const runResult = await window.electron.runExtension(
            extensionFinalContent,
            permissionsArray,
            {
                extensionName: name,
                extensionVersion: version,
                extensionPath: extensionPath,
                isDev: isDev,
                allCSSVariables: getAllCSSVariables()
            }
        )

        sendDebugMarking()

        sendDebugWarn(`Currently, the "${name}" extension and all modules connected to it use special permissions: <b>${permissionsArray.join(", ")}</b>`)

        if (!runResult.success) {
            sendDebugError(`(Extension) ${name}: runtime error: ${runResult.error}`)
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

function createInstalledExtensionsModalTemplate({ title, subtitle, description, image, dependencies, permissions, path }) {
    const tags = []

    Object.keys(dependencies).forEach(d => {
        tags.push(
            {
                type: "module",
                name: `${d} (${dependencies[d]})`
            }
        )
    })

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