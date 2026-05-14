import { Notificator, Options, showNeedReloadTopBar } from "./lib.js"
import { optionsThemeButtonHandler } from "./handlers/themesHandler.js"

import { Modal } from "../js/modalsHandler/engine.js"
import { getDirname, readSettings } from "../../assets/js/global.js"
import { capitilize } from "./lib.js"

import { bus } from "./bus.js"
import { BottomWindow } from "./handlers/BottomWindowHandler.js"

const themeSelect = new Options("themeSelect")
themeSelect.add("default", "Default").default()
themeSelect.add("light", "Light")
themeSelect.add("contrast-dark", "Contrast dark")

const pythonRunnerMethodSelect = new Options("pythonRunnerMethod")

export let settingsSelectors = {}

export function updateSettingSelectors(object) {
    settingsSelectors = object
}

function updateThemeSelectDefault(settingsObject) {
    if ("ui" in settingsObject && "theme" in settingsObject.ui) {
        const instance = themeSelect.get(settingsObject.ui.theme)

        if(instance) instance.default()
    }
}

// creating options

export async function handleSettings(settingsObject) {
    const settings = await readSettings()
    const platform = await window.electron.getPlatform()

    const appearanceModal = Modal.create({
        id: "appearance",
        name: "MyModal",
        modalClassList: ["window"],
        title: "Appearance",

        pages: [
            {
                name: "General",
                icon: "settings",
                content: [
                    {
                        type: "row",
                        classList: ["background"],
                        items: [
                            {
                                type: "switch",
                                title: "Use system fonts",
                                description: "Uses system-ui for the interface and monospace for the editor as fonts",
                                id: "setting_useSystemFonts"
                            },
                            {
                                type: "switch",
                                title: "Splash window",
                                description: "Should the initial window be hidden at startup?",
                                id: "setting_splash"
                            },
                            {
                                type: "switch",
                                title: "Reduce motion",
                                description: "Reduces visual effects throughout the app: fewer animations, optimized animations",
                                id: "setting_reduceMotion"
                            },
                            {
                                type: "switch",
                                title: "Bold font",
                                description: "Increases font weight throughout the application",
                                id: "setting_boldFont"
                            },
                            {
                                type: "placeholder",
                                title: "Theme",
                                description: "Change of theme",
                                id: "setting_theme"
                            },
                            {
                                type: "switch",
                                title: "Developer mode",
                                description: "Enables developer mode",
                                note: "Toggling the switch will restart the app",
                                id: "setting_devMode"
                            },
                            {
                                type: "placeholder",
                                id: "settings_appIcon",
                                title: "App icons",
                                description: "Changes the app icon throughout the app",
                                note: "Toggling the switch will restart the app"
                            },
                        ]
                    }
                ]
            },
            {
                name: "Editor",
                icon: "code",
                content: [
                    {
                        type: "row",
                        classList: ["background"],
                        items: [
                            {
                                type: "range",
                                title: "Text size",
                                description: "Allows you to enlarge text within the editor up to 200%",
                                id: "setting_editorTextSize",
                                min: 50,
                                max: 200,
                                value: 100,
                                step: 10,
                                prefix: "%"
                            },
                            {
                                type: "switch",
                                title: "Smooth scroll",
                                description: "Disable smooth scrolling in the editor?",
                                id: "setting_smoothScroll",
                                note: "For the changes to take effect, you need to restart the app"
                            },
                            {
                                type: "placeholder",
                                title: "Python runner",
                                description: "Select which Python version you would like to use",
                                id: "setting_pythonRunMethod",
                                disabled: platform != "win32",
                                note: platform == "win32" ? "For the changes to take effect, you need to restart the app" : `Your platform (${platform.toUpperCase()}) is not supported. The built-in Python is being used`
                            }
                        ]
                    }
                ]
            }
        ]
    })

    appearanceModal.bind(document.querySelector("#appearance_n"))

    updateSettingSelectors(
        {
            editorTextSize: document.querySelector("#setting_editorTextSize"),
            editorSmoothScroll: document.querySelector("#setting_smoothScroll"),
            useSystemFonts: document.querySelector("#setting_useSystemFonts"),
            boldFont: document.querySelector("#setting_boldFont"),
            devMode: document.querySelector("#setting_devMode"),
            splash: document.querySelector("#setting_splash"),
            reduceMotion: document.querySelector("#setting_reduceMotion"),
        }
    )

    // set app icons choose in settings modal
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
        
        if(isActive) appIcon.classList.add("active")

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

    settingsSelectors.editorTextSize.addEventListener("change", (e) => {
        Setting.editorTextSize(e.target.value)
    })

    settingsSelectors.editorSmoothScroll.addEventListener("change", (e) => {
        let t = e.target
        Setting.editorSmoothScroll(t.checked)
    })

    settingsSelectors.useSystemFonts.addEventListener("click", (e) => {
        let t = e.target
        Setting.useSystemFonts(t.checked)
    })

    settingsSelectors.boldFont.addEventListener("click", (e) => {
        let t = e.target
        Setting.boldFont(t.checked)
    })

    settingsSelectors.devMode.addEventListener("click", (e) => {
        let t = e.target
        Setting.devMode(t.checked)
    })

    settingsSelectors.splash.addEventListener("click", (e) => {
        let t = e.target
        Setting.splash(t.checked)
    })

    settingsSelectors.reduceMotion.addEventListener("click", (e) => {
        let t = e.target
        Setting.reduceMotion(t.checked)
    })

    // handler for options button theme cause it need to be updated. Another one in custom theme handler
    optionsThemeButtonHandler(themeSelect)

    themeSelect.appendTo(document.querySelector("#setting_theme"))

    if(platform == "win32") {
        const pyInfo = await window.electron.getPython()

        pythonRunnerMethodSelect.add("builtin", "Built-in").default()

        if(pyInfo != false) {
            pythonRunnerMethodSelect.add("installed", `User-defined (Python ${pyInfo.version})`)
        }

        pythonRunnerMethodSelect.appendTo(document.querySelector("#setting_pythonRunMethod"))
        pythonRunnerMethodSelect.on("click", (e) => {
            const ID = e.id

            Setting.pythonRunnerMethod(ID)
        })
    }

    updateThemeSelectDefault(settingsObject)

    bus.addEventListener("new-theme-register", (data) => {
        const themeData = data.detail

        updateThemeSelectDefault(settingsObject)
    })

    if(settingsObject.editor) {
        if("fontSize" in settingsObject.editor) Setting.editorTextSize(settingsObject.editor.fontSize, false, false)
        if("smoothScroll" in settingsObject.editor) Setting.editorSmoothScroll(settingsObject.editor.smoothScroll, false, false)
        if("pythonRunnerMethod" in settingsObject.editor) Setting.pythonRunnerMethod(settingsObject.editor.pythonRunnerMethod, false)
    }
    if(settingsObject.ui) {
        if("useSystemFont" in settingsObject.ui) Setting.useSystemFonts(settingsObject.ui.useSystemFont, false)
        if("boldFont" in settingsObject.ui) Setting.boldFont(settingsObject.ui.boldFont, false)
        if("theme" in settingsObject.ui) Setting.themeSelect(settingsObject.ui.theme, false)
    }
    if(settingsObject.app) {
        if("devMode" in settingsObject.app) Setting.devMode(settingsObject.app.devMode, false)
        if("splashScreen" in settingsObject.app) Setting.splash(settingsObject.app.splashScreen, false)
        if("reduceMotion" in settingsObject.app) Setting.reduceMotion(settingsObject.app.reduceMotion, false)
    }
}

export class Setting {
    static editorTextSize(value, notification = true, set = true) {
        let v = Number(value) 
        let defaultFontSize = 15
        let editorFontSize = defaultFontSize * (v / 100)

        if(set) window.electron.setSettings({ editor: { fontSize: v } })

        settingsSelectors.editorTextSize.value = value

        if(notification) {
            const n = new Notificator()
            n.text = v + "%"
            n.icon = "format_size"
            n.show()
        }

        document.body.style.setProperty("--editor-font-size", editorFontSize + "px")
    }
    static editorSmoothScroll(value, notification = true, set = true) {
        if(set) {
            showNeedReloadTopBar()
            window.electron.setSettings({ editor: { smoothScroll: value } })
        }

        settingsSelectors.editorSmoothScroll.value = value

        if(notification) {
            const n = new Notificator()
            n.text = `Smooth scroll ${value ? "Enabled" : "Disabled"}`
            n.icon = "animation"
            n.show()
        }
    }
    static useSystemFonts(value, set = true) {
        if(value) {
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

        if(set) window.electron.setSettings({ ui: { useSystemFont: value } })
    }
    static boldFont(value, set = true) {
        let styleElement = document.createElement("style")
        styleElement.id = "settingsBoldFont"

        if(value) {
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

        if(set) window.electron.setSettings({ ui: { boldFont: value } })
    }
    static themeSelect(value, set = true) {
        let styleElement = document.createElement("style")
        styleElement.id = "settingsLightTheme"

        document.body.setAttribute("theme", value)

        if(themeSelect.get(value) != false) {
            themeSelect.get(value).default()
        }

        if(set) window.electron.setSettings({ ui: { theme: value }})
    }
    static async devMode(value, set = true) {
        settingsSelectors.devMode.checked = value
        
        if(set) {
            await window.electron.setSettings({ app: { devMode: value }})
            window.electron.reload()
        }
    }
    static async splash(value, set = true) {
        settingsSelectors.splash.checked = value
        
        if(set) {
            await window.electron.setSettings({ app: { splashScreen: value }})
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
        
        if(set) {
            await window.electron.setSettings({ app: { reduceMotion: value }})
        }
    }
    static async pythonRunnerMethod(value, set = true) {
        const pythonRunnerMethodSelectGet = pythonRunnerMethodSelect.get(value)
        
        if(pythonRunnerMethodSelectGet) {
            pythonRunnerMethodSelectGet.default()
        }

        if(set) {
            showNeedReloadTopBar()
            await window.electron.setSettings({ editor: { pythonRunnerMethod: value }})
        }
    }
}
