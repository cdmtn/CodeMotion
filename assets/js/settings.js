import { Notificator, Options, showNeedReloadTopBar, GLS, createNotify } from "./lib.js"
import { optionsThemeButtonHandler } from "./handlers/themesHandler.js"

import { readSettings } from "../../assets/js/global.js"
import { capitilize } from "./lib.js"

import { bus, sendEvent } from "./bus.js"
import { BottomWindow } from "./handlers/BottomWindowHandler.js"

import { getSettingsModal } from "./modals/settingsModal.js"

import { setAutosave } from "../../app/renderer.js"

import { SETTINGS } from "./settingsHandler/list.js"
import { themeSelect, pythonRunnerMethodSelect, languageSelect, autosaveSelect } from "./settingsHandler/options.js"
import { AUTOSAVE_DELAY } from "./explorerTree/tabHandler.js"

export let settingsSelectors = {}

function persistPath(path, value) {
    const keys = path.split(".")
    const root = {}
    let node = root
    keys.forEach((key, index) => {
        if (index === keys.length - 1) node[key] = value
        else node = (node[key] = {})
    })
    window.electron.setSettings(root)
}

function readPath(source, path) {
    return path.split(".").reduce((node, key) => (node && typeof node === "object") ? node[key] : undefined, source)
}

function hasPath(source, path) {
    let node = source
    for (const key of path.split(".")) {
        if (node && typeof node === "object" && key in node) node = node[key]
        else return false
    }
    return true
}

function genericApply(entry, value, ctx) {
    const el = settingsSelectors[entry.id]
    if (el) {
        if (entry.control === "switch") el.checked = value
        else if (entry.control === "range") el.value = value
    }
    if (entry.event) sendEvent(entry.event, value)
    if (ctx.persist) persistPath(entry.path, value)
    if (entry.reload && ctx.persist) window.electron.reload()
}

function applyEntry(entry, value, ctx) {
    if (typeof entry.apply === "function") entry.apply(value, ctx)
    else genericApply(entry, value, ctx)
}

function bindControls(get) {
    for (const entry of SETTINGS) {
        if (entry.control === "select" || entry.bind === false) continue

        const el = get(entry.domId || entry.id)
        settingsSelectors[entry.id] = el
        if (!el) continue

        if (entry.control === "action") {
            el.addEventListener("click", () => { if (entry.action) entry.action() })
            continue
        }
        if (entry.control === "element") continue

        el.addEventListener("click", (e) => {
            let target = false
            if (e.target instanceof HTMLInputElement) target = e.target.value
            if (e.target instanceof HTMLInputElement && e.target.type == "checkbox") target = e.target.checked
            applyEntry(entry, target, { persist: true, notify: true })
        })
    }
}

function hydrateSettings(settingsObject) {
    for (const entry of SETTINGS) {
        if (!entry.path) continue
        if (!hasPath(settingsObject, entry.path)) continue
        applyEntry(entry, readPath(settingsObject, entry.path), { persist: false, notify: false })
    }
}

function updateThemeSelectDefault(settingsObject) {
    if ("ui" in settingsObject && "theme" in settingsObject.ui) {
        const instance = themeSelect.get(settingsObject.ui.theme)

        if (instance) instance.default()
    }
}

// creating options

export async function handleSettings(settingsObject) {
    const localObject = await window.electron.getLocal()
    const settings = await readSettings()
    const platform = await window.electron.getPlatform()
    const aviableLanguages = await window.electron.getAllLanguages()
    const gls = await GLS.initLocal()

    // adding options to custom option objects

    themeSelect.add("default", gls.get("modals.appearance.options.themes.default")).default()
    themeSelect.add("light", gls.get("modals.appearance.options.themes.light"))
    themeSelect.add("contrast-dark", gls.get("modals.appearance.options.themes.contrastDark"))

    autosaveSelect.add("off", gls.get("modals.appearance.options.autosave.off")).default()
    autosaveSelect.add("timer", gls.get("modals.appearance.options.autosave.timer", { ms: AUTOSAVE_DELAY }))
    autosaveSelect.add("change", gls.get("modals.appearance.options.autosave.change"))

    // 

    const appearanceModal = await getSettingsModal({ platform: platform })

    appearanceModal.bind(document.querySelector("#appearance_n"))
    appearanceModal.preRender()

    function get(id) {
        return appearanceModal.el.querySelector(`#setting_${id}`)
    }

    bindControls(get)

    // handler for options button theme cause it need to be updated. Another one in custom theme handler
    optionsThemeButtonHandler(themeSelect)

    const appIconsWrapper = document.createElement("div")
    appIconsWrapper.classList.add("modal-appicons")

    document.querySelector("#settings_appIcon .modal-note").after(appIconsWrapper)

    function renderIcon(pathname, name, id) {
        let isActive = settings.app.icon == name.toLowerCase()
        let appIcon = document.createElement("div")

        appIcon.id = id
        appIcon.innerHTML = `
            <div style="background: url('${pathname}');background-size:cover;"></div>
            <p>${name}</p>
        `

        if (isActive) appIcon.classList.add("active")

        appIconsWrapper.appendChild(appIcon)

        appIcon.addEventListener("click", async () => {
            await window.electron.setSettings({ app: { icon: id } })
            await window.electron.reload()
        })
    }
    renderIcon(`../assets/media/codemotion_icon.png`, "Default", "default")

    const appIcons = await window.electron.getAppIcons()
    appIcons.forEach(icon => {
        let appIconCode = icon.split("codemotion-icon-")[1].split(".")[0]
        let appIconCodeNormalize = capitilize(appIconCode.split("-").join(" "))

        renderIcon(`../assets/media/app-icons/${icon}`, appIconCodeNormalize, appIconCode)
    })
    // 

    Setting.githubOAuthRender(localObject)
    Setting.gitlabOAuthRender(localObject)

    themeSelect.appendTo(get("theme"))
    autosaveSelect.appendTo(get("autosave"))

    autosaveSelect.on("click", (e) => {
        const id = e.id

        Setting.autosave(id, true)
    })

    if (platform == "win32") {
        const pyInfo = await window.electron.getPython()

        pythonRunnerMethodSelect.add("builtin", gls.get("modals.appearance.editor.pythonRunner.select.builtIn")).default()

        if (pyInfo != false) {
            pythonRunnerMethodSelect.add("installed", `${gls.get("modals.appearance.editor.pythonRunner.select.userDefined")} (Python ${pyInfo.version})`)
        }

        pythonRunnerMethodSelect.appendTo(document.querySelector("#setting_pythonRunMethod"))
        pythonRunnerMethodSelect.on("click", (e) => {
            const ID = e.id

            Setting.pythonRunnerMethod(ID)
        })
    }

    if (aviableLanguages) {
        for (const index in aviableLanguages) {
            const id = aviableLanguages[index]

            const gls = await GLS.init(id)
            const languageName = gls.get("name")
            const item = languageSelect.add(id, languageName == "name" ? id.toUpperCase() : languageName)

            if (index == 0) item.default()
        }

        function bindLanguageSelect() {
            languageSelect.on("click", (e) => {
                const ID = e.id

                Setting.language(ID)
            })
        }

        // add external languages (from extensions)
        bus.addEventListener("extension-localization-register", (data) => {
            const id = data.detail.langName
            const content = data.detail.configContent
            const from = data.detail.from

            languageSelect.add(id, content.name, { secondary: from })

            bindLanguageSelect()
        })

        bindLanguageSelect()

        languageSelect.appendTo(document.querySelector("#setting_language"))
    }

    updateThemeSelectDefault(settingsObject)

    bus.addEventListener("new-theme-register", (data) => {
        updateThemeSelectDefault(settingsObject)
    })

    hydrateSettings(settingsObject)
}

export class Setting {
    static editorTextSize(value, notification = true, set = true) {
        let v = Number(value)
        let defaultFontSize = 15
        let editorFontSize = defaultFontSize * (v / 100)

        if (set) window.electron.setSettings({ editor: { fontSize: v } })

        settingsSelectors.editorTextSize.value = value

        if (notification) {
            const n = new Notificator()
            n.text = v + "%"
            n.icon = "format_size"
            n.show()
        }

        document.body.style.setProperty("--editor-font-size", editorFontSize + "px")
    }
    static useSystemFonts(value, set = true) {
        if (value) {
            document.body.style.setProperty("--main-font", "system-ui")
            document.body.style.setProperty("--second-font", "system-ui")
            document.body.style.setProperty("--code-font", "monospace")
        }
        else {
            document.body.style.removeProperty("--main-font")
            document.body.style.removeProperty("--second-font")
            document.body.style.removeProperty("--code-font")
        }

        settingsSelectors.useSystemFonts.checked = value

        if (set) window.electron.setSettings({ ui: { useSystemFont: value } })
    }
    static boldFont(value, set = true) {
        let styleElement = document.createElement("style")
        styleElement.id = "settingsBoldFont"

        if (value) {
            document.body.style.setProperty("--default-font-weight", "800")
            document.body.style.setProperty("--bold-font-weight", "800")
            document.body.style.setProperty("--medium-font-weight", "700")
        }
        else {
            document.body.style.removeProperty("--default-font-weight")
            document.body.style.removeProperty("--bold-font-weight")
            document.body.style.removeProperty("--medium-font-weight")
        }

        settingsSelectors.boldFont.checked = value

        if (set) window.electron.setSettings({ ui: { boldFont: value } })
    }
    static themeSelect(value, set = true) {
        let styleElement = document.createElement("style")
        styleElement.id = "settingsLightTheme"

        document.body.setAttribute("theme", value)

        if (themeSelect.get(value) != false) {
            themeSelect.get(value).default()
        }

        if (set) window.electron.setSettings({ ui: { theme: value } })
    }
    static async reduceMotion(value, set = true) {
        settingsSelectors.reduceMotion.checked = value

        BottomWindow.settings = {
            ...BottomWindow.settings,
            app: {
                ...BottomWindow.settings?.app,
                reduceMotion: value
            }
        }
        window.dispatchEvent(new CustomEvent("codemotion-reduce-motion-change", {
            detail: { reduceMotion: value }
        }))

        if (set) {
            await window.electron.setSettings({ app: { reduceMotion: value } })
        }
    }
    static async pythonRunnerMethod(value, set = true) {
        const pythonRunnerMethodSelectGet = pythonRunnerMethodSelect.get(value)

        if (pythonRunnerMethodSelectGet) {
            pythonRunnerMethodSelectGet.default()
        }

        if (set) {
            showNeedReloadTopBar()
            await window.electron.setSettings({ editor: { pythonRunnerMethod: value } })
        }
    }
    static uiScale(value, notification = true, set = true) {
        let v = Number(value)

        if (set) window.electron.setSettings({ app: { uiScale: v } })

        settingsSelectors.uiScale.value = value

        if (notification) {
            const n = new Notificator()
            n.text = value + "x"
            n.icon = "linear_scale"
            n.show()
        }

        document.body.style.setProperty("--ui-scale", value)
    }
    static async language(value, set = true) {
        async function update() {
            const languageSelectGet = languageSelect.get(value)

            if (languageSelectGet) {
                languageSelectGet.default()
            }

            if (set) {
                showNeedReloadTopBar()
                await window.electron.setSettings({ app: { language: value } })
            }
        }

        update()

        bus.addEventListener("extension-localization-register", update)
    }
    static async autosave(value, set = true) {
        if (autosaveSelect.get(value)) autosaveSelect.get(value).default()

        setAutosave(value);

        if (set) {
            await window.electron.setSettings({ editor: { autosave: value } })
        }
    }

    //GitHub OAuth Start
    static githubOAuthRender(localObject) {
        const userInfoContainer = settingsSelectors.githubOAuthUserInfo
        const pendingContainer = settingsSelectors.githubOAuthPending
        const loginBtn = settingsSelectors.githubOAuthLogin
        const disconnectBtn = settingsSelectors.githubOAuthDisconnect

        if (!userInfoContainer || !pendingContainer || !loginBtn || !disconnectBtn) return

        userInfoContainer.innerHTML = ""
        pendingContainer.innerHTML = ""

        if (localObject.githubOAuthUser) {
            const user = localObject.githubOAuthUser
            const displayName = user.name || user.login

            userInfoContainer.innerHTML = `
                <div class="github-oauth-user">
                    <img class="github-oauth-avatar" src="${user.avatar_url}" alt="${user.login}" />
                    <div class="github-oauth-info">
                        <span class="github-oauth-name">${displayName} (${user.login})</span>
                    </div>
                </div>
            `
            loginBtn.style.display = "none"
            disconnectBtn.style.display = ""
        } else {
            loginBtn.style.display = ""
            disconnectBtn.style.display = "none"
        }
    }

    static async githubOAuthStart() {
        const gls = GLS.initLocal()
        const loginBtn = settingsSelectors.githubOAuthLogin
        const pendingContainer = settingsSelectors.githubOAuthPending

        loginBtn.disabled = true
        loginBtn.textContent = gls.get("modals.appearance.gitGithub.oauth.buttons.connecting")

        const res = await window.electron.githubOAuthStart()

        if (!res.success) {
            loginBtn.disabled = false
            loginBtn.textContent = gls.get("modals.appearance.gitGithub.oauth.buttons.login")

            createNotify({
                type: "danger",
                icon: "cancel",
                title: "GitHub OAuth error",
                content: res.error || "Failed to start device flow"
            })
            return
        }

        pendingContainer.innerHTML = `
            <div class="github-oauth-pending">
                <span class="github-oauth-code">${res.userCode}</span>
                <span class="github-oauth-hint">${gls.get("modals.appearance.gitGithub.oauth.pending.hint", { url: res.verificationUri })}</span>
            </div>
        `
        loginBtn.textContent = gls.get("modals.appearance.gitGithub.oauth.buttons.waiting")

        let interval = (res.interval || 5) * 1000
        let expired = false

        const poll = async () => {
            if (expired) return

            const pollRes = await window.electron.githubOAuthPoll(res.deviceCode)

            if (pollRes.success) {
                loginBtn.textContent = gls.get("modals.appearance.gitGithub.oauth.buttons.login")
                loginBtn.disabled = false
                pendingContainer.innerHTML = ""

                const localObject = await window.electron.getLocal()
                Setting.githubOAuthRender(localObject)

                createNotify({
                    type: "success",
                    icon: "check",
                    title: gls.get("modals.appearance.gitGithub.oauth.notifications.success.title"),
                    content: gls.get("modals.appearance.gitGithub.oauth.notifications.success.description")
                })
                return
            }

            if (pollRes.status === "pending") {
                setTimeout(poll, interval)
                return
            }
            if (pollRes.status === "slow_down") {
                interval += 5000
                setTimeout(poll, interval)
                return
            }

            expired = true
            loginBtn.textContent = gls.get("modals.appearance.gitGithub.oauth.buttons.login")
            loginBtn.disabled = false
            pendingContainer.innerHTML = ""

            if (pollRes.status === "denied") {
                createNotify({
                    type: "danger",
                    icon: "cancel",
                    title: "GitHub OAuth",
                    content: gls.get("modals.appearance.gitGithub.oauth.notifications.denied")
                })
            } else if (pollRes.status === "expired") {
                createNotify({
                    type: "danger",
                    icon: "cancel",
                    title: "GitHub OAuth",
                    content: gls.get("modals.appearance.gitGithub.oauth.notifications.expired")
                })
            } else {
                createNotify({
                    type: "danger",
                    icon: "cancel",
                    title: "GitHub OAuth error",
                    content: pollRes.error || "Authentication failed"
                })
            }
        }

        setTimeout(poll, interval)
    }

    static async githubOAuthDisconnect() {
        const gls = GLS.initLocal()

        await window.electron.githubOAuthDisconnect()

        const localObject = await window.electron.getLocal()
        Setting.githubOAuthRender(localObject)

        createNotify({
            type: "success",
            icon: "check",
            title: gls.get("modals.appearance.gitGithub.oauth.notifications.disconnected.title"),
            content: gls.get("modals.appearance.gitGithub.oauth.notifications.disconnected.description")
        })
    }

    //GitLab OAuth Start
    static gitlabOAuthRender(localObject) {
        const userInfoContainer = settingsSelectors.gitlabOAuthUserInfo
        const pendingContainer = settingsSelectors.gitlabOAuthPending
        const loginBtn = settingsSelectors.gitlabOAuthLogin
        const disconnectBtn = settingsSelectors.gitlabOAuthDisconnect

        if (!userInfoContainer || !pendingContainer || !loginBtn || !disconnectBtn) return

        userInfoContainer.innerHTML = ""
        pendingContainer.innerHTML = ""

        if (localObject.gitlabOAuthUser) {
            const user = localObject.gitlabOAuthUser
            const displayName = user.name || user.login

            userInfoContainer.innerHTML = `
                <div class="github-oauth-user">
                    <img class="github-oauth-avatar" src="${user.avatar_url}" alt="${user.username}" />
                    <div class="github-oauth-info">
                        <span class="github-oauth-name">${displayName} (${user.username})</span>
                    </div>
                </div>
            `
            loginBtn.style.display = "none"
            disconnectBtn.style.display = ""
        } else {
            loginBtn.style.display = ""
            disconnectBtn.style.display = "none"
        }
    }

    static async gitlabOAuthStart() {
        const gls = GLS.initLocal()
        const loginBtn = settingsSelectors.gitlabOAuthLogin
        const pendingContainer = settingsSelectors.gitlabOAuthPending

        if (!loginBtn) {
            return
        }

        loginBtn.disabled = true
        loginBtn.textContent = gls.get("modals.appearance.gitlab.oauth.buttons.connecting")

        const res = await window.electron.gitlabOAuthStart()

        if (!res.success) {
            loginBtn.disabled = false
            loginBtn.textContent = gls.get("modals.appearance.gitlab.oauth.buttons.login")

            createNotify({
                type: "danger",
                icon: "cancel",
                title: "GitLab OAuth error",
                content: res.error || "Failed to start device flow"
            })
            return
        }

        pendingContainer.innerHTML = `
            <div class="github-oauth-pending">
                <span class="github-oauth-code">${res.userCode}</span>
                <span class="github-oauth-hint">${gls.get("modals.appearance.gitlab.oauth.pending.hint", { url: res.verificationUri })}</span>
            </div>
        `
        loginBtn.textContent = gls.get("modals.appearance.gitlab.oauth.buttons.waiting")

        let interval = (res.interval || 5) * 1000
        let expired = false

        const poll = async () => {
            if (expired) return

            const pollRes = await window.electron.gitlabOAuthPoll(res.deviceCode)

            if (pollRes.success) {
                loginBtn.textContent = gls.get("modals.appearance.gitlab.oauth.buttons.login")
                loginBtn.disabled = false
                pendingContainer.innerHTML = ""

                const localObject = await window.electron.getLocal()
                Setting.gitlabOAuthRender(localObject)

                createNotify({
                    type: "success",
                    icon: "check",
                    title: gls.get("modals.appearance.gitlab.oauth.notifications.success.title"),
                    content: gls.get("modals.appearance.gitlab.oauth.notifications.success.description")
                })
                return
            }

            if (pollRes.status === "pending") {
                setTimeout(poll, interval)
                return
            }
            if (pollRes.status === "slow_down") {
                interval += 5000
                setTimeout(poll, interval)
                return
            }

            expired = true
            loginBtn.textContent = gls.get("modals.appearance.gitlab.oauth.buttons.login")
            loginBtn.disabled = false
            pendingContainer.innerHTML = ""

            if (pollRes.status === "denied") {
                createNotify({
                    type: "danger",
                    icon: "cancel",
                    title: "GitLab OAuth",
                    content: gls.get("modals.appearance.gitlab.oauth.notifications.denied")
                })
            } else if (pollRes.status === "expired") {
                createNotify({
                    type: "danger",
                    icon: "cancel",
                    title: "GitLab OAuth",
                    content: gls.get("modals.appearance.gitlab.oauth.notifications.expired")
                })
            } else {
                createNotify({
                    type: "danger",
                    icon: "cancel",
                    title: "GitLab OAuth error",
                    content: pollRes.error || "Authentication failed"
                })
            }
        }

        setTimeout(poll, interval)
    }

    static async gitlabOAuthDisconnect() {
        const gls = GLS.initLocal()

        await window.electron.gitlabOAuthDisconnect()

        const localObject = await window.electron.getLocal()
        Setting.gitlabOAuthRender(localObject)

        createNotify({
            type: "success",
            icon: "check",
            title: gls.get("modals.appearance.gitlab.oauth.notifications.disconnected.title"),
            content: gls.get("modals.appearance.gitlab.oauth.notifications.disconnected.description")
        })
    }
}