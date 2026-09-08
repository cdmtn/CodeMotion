import { Notificator, Options, showNeedReloadTopBar, GLS, createNotify } from "./lib.js"
import { optionsThemeButtonHandler } from "./handlers/themesHandler.js"

import { getDirname, readSettings } from "../../assets/js/global.js"
import { capitilize } from "./lib.js"

import { bus, sendEvent } from "./bus.js"
import { BottomWindow } from "./handlers/BottomWindowHandler.js"

import { getSettingsModal } from "./modals/settingsModal.js"

import { setAutosave } from "../../app/renderer.js"

const themeSelect = new Options("themeSelect")
themeSelect.add("default", "Default").default()
themeSelect.add("light", "Default Light")
themeSelect.add("contrast-dark", "Contrast dark")

const pythonRunnerMethodSelect = new Options("pythonRunnerMethod")
const languageSelect = new Options("languageSelect")

export let settingsSelectors = {}

export function updateSettingSelectors(object) {
    settingsSelectors = object
}

function updateThemeSelectDefault(settingsObject) {
    if ("ui" in settingsObject && "theme" in settingsObject.ui) {
        const instance = themeSelect.get(settingsObject.ui.theme)

        if (instance) instance.default()
    }
}

function setupListener(property, callback) {
    if (property in settingsSelectors) {
        settingsSelectors[property].addEventListener("click", (e) => {
            let target = false;

            if(e.target instanceof HTMLInputElement) target = e.target.value
            if(e.target instanceof HTMLInputElement && e.target.type == "checkbox") target = e.target.checked

            callback({ target: target })
        })
    }
}

// creating options

export async function handleSettings(settingsObject) {
    const localObject = await window.electron.getLocal()
    const settings = await readSettings()
    const platform = await window.electron.getPlatform()
    const aviableLanguages = await window.electron.getAllLanguages()
    const gls = await GLS.initLocal()

    const appearanceModal = await getSettingsModal({ platform: platform })

    appearanceModal.bind(document.querySelector("#appearance_n"))
    appearanceModal.preRender()

    function get(id) {
        return appearanceModal.el.querySelector(`#setting_${id}`)
    }

    updateSettingSelectors(
        {
            editorTextSize: get("editorTextSize"),
            useSystemFonts: get("useSystemFonts"),
            boldFont: get("boldFont"),
            devMode: get("devMode"),
            splash: get("splash"),
            reduceMotion: get("reduceMotion"),
            uiScale: get("uiScale"),

            coloredTabs: get("coloredTabs"),
            confirmCloseTab: get("confirmCloseTab"),
            restoreFolder: get("restoreFolder"),

            goContextParser: get("go_context_parser"),
            autosave: get("autosave"),

            disableRiskyPermissionWarning: get("disableRiskyPermissionWarning"),
            useSystemNotifications: get("useSystemNotifications"),

            githubOAuthLogin: get("githubOAuthLogin"),
            githubOAuthDisconnect: get("githubOAuthDisconnect"),
            githubOAuthUserInfo: get("githubOAuthUserInfo"),
            githubOAuthPending: get("githubOAuthPending"),

            gitlabOAuthLogin: get("gitlabOAuthLogin"),
            gitlabOAuthDisconnect: get("gitlabOAuthDisconnect"),
            gitlabOAuthUserInfo: get("gitlabOAuthUserInfo"),
            gitlabOAuthPending: get("gitlabOAuthPending"),
        }
    )

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

    // context parsers
    setupListener("goContextParser", ({ target }) => {
        Setting.goContextParser(target)
    })

    setupListener("autosave", ({ target }) => {
        Setting.autosave(target)
    })

    setupListener("disableRiskyPermissionWarning", ({ target }) => {
        Setting.disableRiskyPermissionWarning(target)
    })

    setupListener("useSystemNotifications", ({ target }) => {
        Setting.useSystemNotifications(target)
    })

    //

    setupListener("coloredTabs", ({ target }) => {
        Setting.coloredTabs(target)
    })

    setupListener("confirmCloseTab", ({ target }) => {
        Setting.confirmCloseTab(target)
    })

    setupListener("restoreFolder", ({ target }) => {
        Setting.restoreFolder(target)
    })

    setupListener("editorTextSize", ({ target }) => {
        Setting.editorTextSize(target)
    })

    setupListener("useSystemFonts", ({ target }) => {
        Setting.useSystemFonts(target)
    })

    setupListener("boldFont", ({ target }) => {
        Setting.boldFont(target)
    })

    setupListener("devMode", ({ target }) => {
        Setting.devMode(target)
    })

    setupListener("splash", ({ target }) => {
        Setting.splash(target)
    })

    setupListener("reduceMotion", ({ target }) => {
        Setting.reduceMotion(target)
    })

    setupListener("uiScale", ({ target }) => {
        Setting.uiScale(target)
    })

    setupListener("githubOAuthLogin", ({ target }) => {
        Setting.githubOAuthStart(target)
    })

    setupListener("githubOAuthDisconnect", ({ target }) => {
        Setting.githubOAuthDisconnect(target)
    })

    Setting.githubOAuthRender(localObject)

    setupListener("gitlabOAuthLogin", ({ target }) => {
        Setting.gitlabOAuthStart(target)
    })

    setupListener("gitlabOAuthDisconnect", ({ target }) => {
        Setting.gitlabOAuthDisconnect(target)
    })

    Setting.gitlabOAuthRender(localObject)

    themeSelect.appendTo(document.querySelector("#setting_theme"))

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

    if (settingsObject.editor) {
        if ("fontSize" in settingsObject.editor) Setting.editorTextSize(settingsObject.editor.fontSize, false, false)
        if ("pythonRunnerMethod" in settingsObject.editor) Setting.pythonRunnerMethod(settingsObject.editor.pythonRunnerMethod, false)
        if ("coloredTabs" in settingsObject.editor) Setting.coloredTabs(settingsObject.editor.coloredTabs, false)
        if ("confirmCloseTab" in settingsObject.editor) Setting.confirmCloseTab(settingsObject.editor.confirmCloseTab, false)

        if ("goContextParser" in settingsObject.editor) Setting.goContextParser(settingsObject.editor.goContextParser, false)
        if ("autosave" in settingsObject.editor) Setting.autosave(settingsObject.editor.autosave, false)
    }
    if (settingsObject.ui) {
        if ("useSystemFont" in settingsObject.ui) Setting.useSystemFonts(settingsObject.ui.useSystemFont, false)
        if ("boldFont" in settingsObject.ui) Setting.boldFont(settingsObject.ui.boldFont, false)
        if ("theme" in settingsObject.ui) Setting.themeSelect(settingsObject.ui.theme, false)
    }
    if (settingsObject.app) {
        if ("devMode" in settingsObject.app) Setting.devMode(settingsObject.app.devMode, false)
        if ("splashScreen" in settingsObject.app) Setting.splash(settingsObject.app.splashScreen, false)
        if ("reduceMotion" in settingsObject.app) Setting.reduceMotion(settingsObject.app.reduceMotion, false)
        if ("uiScale" in settingsObject.app) Setting.uiScale(settingsObject.app.uiScale, false, false)
        if ("language" in settingsObject.app) Setting.language(settingsObject.app.language, false)
        if ("restoreFolder" in settingsObject.app) Setting.restoreFolder(settingsObject.app.restoreFolder, false)
        if ("useSystemNotifications" in settingsObject.app) Setting.useSystemNotifications(settingsObject.app.useSystemNotifications, false)
    }
    if (settingsObject.extensions) {
        if ("disableRiskyPermissionWarning" in settingsObject.extensions) Setting.disableRiskyPermissionWarning(settingsObject.extensions.disableRiskyPermissionWarning, false)
    }
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
    static async devMode(value, set = true) {
        settingsSelectors.devMode.checked = value

        if (set) {
            await window.electron.setSettings({ app: { devMode: value } })
            window.electron.reload()
        }
    }
    static async splash(value, set = true) {
        settingsSelectors.splash.checked = value

        if (set) {
            await window.electron.setSettings({ app: { splashScreen: value } })
        }
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
    static async coloredTabs(value, set = true) {
        settingsSelectors.coloredTabs.checked = value

        sendEvent("on-setting-colored-tabs", value)

        if (set) {
            await window.electron.setSettings({ editor: { coloredTabs: value } })
        }
    }
    static async restoreFolder(value, set = true) {
        settingsSelectors.restoreFolder.checked = value

        if (set) {
            await window.electron.setSettings({ app: { restoreFolder: value } })
        }
    }
    static async useSystemNotifications(value, set = true) {
        settingsSelectors.useSystemNotifications.checked = value

        if (set) {
            await window.electron.setSettings({ app: { useSystemNotifications: value } })
        }
    }
    static async confirmCloseTab(value, set = true) {
        settingsSelectors.confirmCloseTab.checked = value

        if (set) {
            await window.electron.setSettings({ editor: { confirmCloseTab: value } })
        }
    }
    static async goContextParser(value, set = true) {
        settingsSelectors.goContextParser.checked = value

        if (set) {
            await window.electron.setSettings({ editor: { goContextParser: value } })
        }
    }
    static async autosave(value, set = true) {
        settingsSelectors.autosave.checked = value

        if (set) {
            await window.electron.setSettings({ editor: { autosave: value } })
            setAutosave(value);
        }
    }
    static async disableRiskyPermissionWarning(value, set = true) {
        settingsSelectors.disableRiskyPermissionWarning.checked = value

        if (set) {
            await window.electron.setSettings({ extensions: { disableRiskyPermissionWarning: value } })
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