import { createNotify, getAllCSSVariables, normalizePath } from "../lib.js"
import { sendDebugMsg, sendDebugError, sendDebugWarn, sendDebugModuleInfo, sendDebugMarking } from "../handlers/debuggerSignalHandlers.js"
import { handleExtensionEvents } from "./extensionEventsHandler.js"
import { Modal } from "../modalsHandler/engine.js"
import { bus } from "../bus.js"

const installedExtensionModalData = []
const extensionErrors = {}

const RISKY_PERMISSIONS = [
    "shell.run",
    "shell.exec",
    "shell.kill",
    "window.create",
    "window.close"
]

function hasRiskyPermissions(permissions) {
    return permissions.filter(p => RISKY_PERMISSIONS.includes(p))
}

function showRiskyPermissionWarning({ displayName, name, riskyPerms }) {
    return new Promise((resolve) => {
        const modal = Modal.create({
            id: "riskyPermissionWarning",
            name: "Risky Permissions",
            title: "Risky Permissions Detected",
            modalClassList: ["window"],
            size: "mini",
            content: [
                {
                    type: "row",
                    classList: ["modal-content"],
                    items: [
                        {
                            type: "container",
                            id: "perm-warning-body",
                            html: `
                                <div class="confirm-desc" style="margin-bottom:12px">You are launching an <b>unverified</b> extension that uses risky permissions:<br><b>${displayName}</b> <span style="opacity:.5">(${name})</span></div>
                                <div style="background:var(--block-divider-border-color);border-radius:8px;padding:10px 14px;margin:10px 0;font-size:12px;font-family:'JetBrains Mono',monospace">Uses: ${riskyPerms.join(", ")}</div>
                                <div style="font-size:11px;opacity:.45;line-height:1.5">You can disable this warning in Settings &gt; Extensions.</div>
                                <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
                                    <button class="modal-button default" id="perm-warning-no">No, disable it</button>
                                    <button class="modal-button default" id="perm-warning-yes">Yes, enable it</button>
                                </div>
                            `
                        }
                    ]
                }
            ]
        })

        modal.open()

        const noBtn = modal.el.querySelector("#perm-warning-no")
        const yesBtn = modal.el.querySelector("#perm-warning-yes")

        if (noBtn) noBtn.addEventListener("click", () => {
            modal.close()
            modal.destroy()
            resolve(false)
        })
        if (yesBtn) yesBtn.addEventListener("click", () => {
            modal.close()
            modal.destroy()
            resolve(true)
        })
    })
}

const VALID_PLATFORMS = ["windows", "win", "macos", "mac", "linux", "lin", "all"]
const PLATFORM_ALIASES = { win: "windows", mac: "macos", lin: "linux", win32: "windows", darwin: "macos" }

function normalizePlatform(p) {
    return PLATFORM_ALIASES[p] || p
}

function isPlatformCompatible(platformArray, currentPlatform) {
    const normalized = platformArray.map(normalizePlatform)
    const normalizedCurrent = normalizePlatform(currentPlatform)
    if (normalized.includes("all")) return true
    return normalized.includes(normalizedCurrent)
}

function checkPackage(object) {
    if (!object || Object.keys(object).length === 0) {
        return { success: false, msg: "File missing or empty" }
    }

    const requireFields = ["version", "name", "displayName", "main", "permissions", "description", "activeOn", "platform"]

    for (const f of requireFields) {
        if (!(f in object)) {
            return { success: false, msg: `Missing field: ${f}` }
        }
    }

    const platform = object.platform

    if (typeof platform === "string") {
        if (!VALID_PLATFORMS.includes(platform)) {
            return { success: false, msg: `Invalid platform "${platform}". Valid: ${VALID_PLATFORMS.join(", ")}` }
        }
        object.platform = [platform]
    } else if (Array.isArray(platform)) {
        if (platform.length === 0) {
            return { success: false, msg: "Field 'platform' must be a non-empty array" }
        }
        for (const p of platform) {
            if (!VALID_PLATFORMS.includes(p)) {
                return { success: false, msg: `Invalid platform "${p}". Valid: ${VALID_PLATFORMS.join(", ")}` }
            }
        }
    } else {
        return { success: false, msg: "Field 'platform' must be a string or array" }
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

function renderExtensionsModal(properties) {
    Modal.destroy("installedExtensions")

    const extensionsAllBtn = document.querySelector("#extensionsAll")
    const items = properties == undefined ? [{ type: "centered", icon: "extension" }] : properties

    const installedExtensionsModal = Modal.create({
        id: "installedExtensions",
        name: "Installed Extensions",
        modalClassList: ["window"],
        title: "Installed extensions",

        content: [
            {
                type: "row",
                classList: ["background"],
                items: items
            },
        ]
    })

    installedExtensionsModal.bind(extensionsAllBtn)
}

export async function initExtensions() {
    handleExtensionEvents()
    renderExtensionsModal()

    const extensionsRequest = await window.electron.requestExtensions()
    const extensionsDir = await window.electron.getExtensionsDir()

    if (!extensionsRequest.success) return

    const names = extensionsRequest.result
    const settings = await window.electron.readSettings()
    const currentPlatform = await window.electron.getPlatform()

    // PROCEED EACH EXT
    for (const name of names) {
        const extensionRequest = await window.electron.requestExtension(name)

        if (!extensionRequest.success) {
            notifyError({ name: name, content: extensionRequest.result })
            sendDebugError(`(Extension) ${name}: load error. ${extensionRequest.result}`)
            if (!extensionErrors[name]) extensionErrors[name] = []
            extensionErrors[name].push(extensionRequest.result)

            installedExtensionModalData.push(
                createInstalledExtensionsModalTemplate({
                    title: name,
                    subtitle: "Failed to load",
                    description: "This extension could not be loaded.",
                    image: name,
                    permissions: new Set(),
                    path: "",
                    extensionName: name
                })
            )
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
            if (!extensionErrors[name]) extensionErrors[name] = []
            extensionErrors[name].push(extensionPackageCheck.msg)

            installedExtensionModalData.push(
                createInstalledExtensionsModalTemplate({
                    title: name,
                    subtitle: "Failed to load",
                    description: "This extension has an invalid configuration.",
                    image: name,
                    permissions: new Set(),
                    path: extensionPath,
                    extensionName: name
                })
            )
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
        }

        let extensionMainFileContentRes = await window.electron.readFile(`/${name}/${main}.js`, extensionsDir)

        if (!extensionMainFileContentRes.success) {
            notifyError({ name: displayName, content: extensionMainFileContentRes.result })
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
        if("filenames.register" in extensionPackage) {
            const filenamesConfig = extensionPackage["filenames.register"]

            if(filenamesConfig.length > 0) {
                window.electron.ext.editor.filenames.register(
                    {
                        configPath: filenamesConfig,
                        extensionPath: normalizePath(extensionPath),
                        extensionName: name
                    }
                )
            }
        }
        if("fileExtensions.register" in extensionPackage) {
            const fileExtensionsConfig = extensionPackage["fileExtensions.register"]

            if(fileExtensionsConfig.length > 0) {
                window.electron.ext.editor.fileExtensions.register(
                    {
                        configPath: fileExtensionsConfig,
                        extensionPath: normalizePath(extensionPath),
                        extensionName: name
                    }
                )
            }
        }
        if("templates.register" in extensionPackage) {
            const templatesConfig = extensionPackage["templates.register"]

            if(templatesConfig.length > 0) {
                window.electron.ext.editor.templates.register(
                    {
                        configPath: templatesConfig,
                        extensionPath: normalizePath(extensionPath),
                        extensionName: name
                    }
                )
            }
        }
        
        // platform check
        const extPlatforms = Array.isArray(extensionPackage.platform) ? extensionPackage.platform : [extensionPackage.platform]
        if (!isPlatformCompatible(extPlatforms, currentPlatform)) {
            sendDebugWarn(`${name}: skipped — not compatible with ${currentPlatform} (supports: ${extPlatforms.join(", ")})`)
            continue
        }

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
            const riskyPerms = hasRiskyPermissions(permissionsArray)

            if (riskyPerms.length > 0) {
                const disableWarning = settings?.extensions?.disableRiskyPermissionWarning === true

                if (!disableWarning) {
                    const approved = await showRiskyPermissionWarning({
                        displayName: displayName,
                        name: name,
                        riskyPerms: riskyPerms
                    })

                    if (!approved) {
                        sendDebugWarn(`${name}: extension disabled by user (risky permissions declined)`)
                        return
                    }
                }
            }

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
                sendDebugError(`${name} runtime error: ${runResult.error}`)
            }
        }
    }

    renderExtensionsModal(installedExtensionModalData)
}

function showExtensionErrors(extensionName) {
    const errors = extensionErrors[extensionName] || []
    if (errors.length === 0) return

    const existing = document.getElementById("extensionErrorsPopup")
    if (existing) existing.remove()

    const wrapper = document.createElement("div")
    wrapper.id = "extensionErrorsPopup"
    wrapper.style.cssText = "position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.4);backdrop-filter:blur(4px);animation:fadeIn .15s ease"

    const modal = document.createElement("div")
    modal.className = "modal confirm"
    modal.style.cssText = "background:var(--body-color);color:var(--text-color);position:relative;border-radius:15px;overflow:hidden;border:1px solid var(--block-divider-border-color);width:400px;height:auto;min-height:160px;max-height:350px;display:flex;flex-direction:column"

    const body = document.createElement("div")
    body.style.cssText = "flex:1;overflow-y:auto;padding:20px;padding-bottom:0"

    const title = document.createElement("div")
    title.className = "confirm-title"
    title.textContent = `Errors — ${extensionName}`

    const desc = document.createElement("div")
    desc.className = "confirm-desc"

    const errorList = document.createElement("div")
    errorList.style.cssText = "margin-top:8px;display:flex;flex-direction:column;gap:6px"

    errors.forEach((err, i) => {
        const item = document.createElement("div")
        item.className = "extension-error-item"
        item.textContent = `${i + 1}. ${err}`
        errorList.appendChild(item)
    })

    desc.appendChild(errorList)
    body.appendChild(title)
    body.appendChild(desc)

    const btnWrapper = document.createElement("div")
    btnWrapper.style.cssText = "display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--block-divider-border-color)"

    const btnStyle = "background:var(--block-divider-border-color);border:none;color:var(--text-color);padding:8px 12px;border-radius:5px;transition:.2s;cursor:pointer;font-family:inherit;font-size:13px"

    const copyBtn = document.createElement("button")
    copyBtn.textContent = "Copy"
    copyBtn.style.cssText = btnStyle
    copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(errors.join("\n"))
        createNotify({ type: "success", icon: "check", title: "Errors copied to clipboard" })
    })
    copyBtn.addEventListener("mouseenter", () => { copyBtn.style.opacity = ".5" })
    copyBtn.addEventListener("mouseleave", () => { copyBtn.style.opacity = "1" })

    const closeBtn = document.createElement("button")
    closeBtn.textContent = "Close"
    closeBtn.style.cssText = btnStyle
    closeBtn.addEventListener("click", () => wrapper.remove())
    closeBtn.addEventListener("mouseenter", () => { closeBtn.style.opacity = ".5" })
    closeBtn.addEventListener("mouseleave", () => { closeBtn.style.opacity = "1" })

    btnWrapper.appendChild(copyBtn)
    btnWrapper.appendChild(closeBtn)

    modal.appendChild(body)
    modal.appendChild(btnWrapper)
    wrapper.appendChild(modal)

    wrapper.addEventListener("click", (e) => {
        if (e.target === wrapper) wrapper.remove()
    })

    document.body.appendChild(wrapper)
}

function createInstalledExtensionsModalTemplate({ title, subtitle, description, image, permissions, path, extensionName }) {
    const tags = []

    for (const p of permissions) {
        tags.push({
            type: "permission",
            name: p
        })
    }

    const buttons = []

    if (extensionName && extensionErrors[extensionName]) {
        buttons.push({
            icon: "error",
            classList: ["text-danger"],
            onclick: () => {
                showExtensionErrors(extensionName)
            }
        })
    }

    buttons.push({
        icon: "delete",
        onclick: (data) => {
            data.element.remove()
            window.electron.removeByPath(path)
        }
    })

    const template = {
        type: "extensionItem",
        title: title,
        subtitle: subtitle,
        description: description,
        image: image,
        tags: tags,
        buttons: buttons
    }

    return template
}