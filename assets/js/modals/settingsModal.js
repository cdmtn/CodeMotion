import { Modal } from "../modalsHandler/engine.js"
import { GLS } from "../lib.js"

export async function getSettingsModal({ platform }) {
    const gls = await GLS.init()
    
    function lgls(string, replacements) {
        return gls.get(`modals.appearance.${string}`, replacements)
    }

    const appearanceModal = Modal.create({
        id: "appearance",
        name: "MyModal",
        modalClassList: ["window"],
        title: lgls("title"),

        pages: [
            {
                name: lgls("generalCategory"),
                icon: "settings",
                content: [
                    {
                        type: "category",
                        label: lgls("application.applicationLabel"),
                        items: []
                    },
                    {
                        type: "row",
                        classList: ["background"],
                        items: [
                            {
                                type: "range",
                                title: lgls("application.uiScale.title"),
                                description: lgls("application.uiScale.description"),
                                id: "setting_uiScale",
                                min: 0.5,
                                max: 4,
                                value: 1,
                                step: 0.1,
                                prefix: "x"
                            },
                            {
                                type: "placeholder",
                                title: lgls("application.language.title"),
                                description: lgls("application.language.description"),
                                note: gls.get("modals.needToReloadNote"),
                                id: "setting_language"
                            },
                            {
                                type: "switch",
                                title: lgls("application.useSystemFonts.title"),
                                description: lgls("application.useSystemFonts.description"),
                                id: "setting_useSystemFonts"
                            },
                            {
                                type: "switch",
                                title: lgls("application.splashWindow.title"),
                                description: lgls("application.splashWindow.description"),
                                id: "setting_splash"
                            },
                            {
                                type: "switch",
                                title: lgls("application.reduceMotion.title"),
                                description: lgls("application.reduceMotion.description"),
                                id: "setting_reduceMotion"
                            },
                            {
                                type: "switch",
                                title: lgls("application.boldFont.title"),
                                description: lgls("application.boldFont.description"),
                                id: "setting_boldFont"
                            },
                            {
                                type: "placeholder",
                                title: lgls("application.theme.title"),
                                description: lgls("application.theme.description"),
                                id: "setting_theme"
                            },
                            {
                                type: "switch",
                                title: lgls("application.developerMode.title"),
                                description: lgls("application.developerMode.description"),
                                note: gls.get("modals.needToReloadNote"),
                                id: "setting_devMode"
                            },
                            {
                                type: "placeholder",
                                id: "settings_appIcon",
                                title: lgls("application.appIcons.title"),
                                description: lgls("application.appIcons.description"),
                                note: gls.get("modals.appReloadNote")
                            },
                        ]
                    }
                ]
            },
            {
                name: lgls("sideBarCategory"),
                icon: "dock_to_left",
                content: [
                    {
                        type: "category",
                        label: lgls("sideBarCategory"),
                        items: []
                    },
                    {
                        type: "row",
                        classList: ["background"],
                        items: [
                            {
                                type: "switch",
                                title: "Show hidden files",
                                description: "Displays files and folders starting with a dot (e.g. .gitignore)",
                                id: "setting_sidebarShowHiddenFiles",
                                disabled: true
                            }
                        ]
                    }
                ]
            },
            {
                name: lgls("terminalCategory"),
                icon: "terminal",
                content: [
                    {
                        type: "category",
                        label: "Appearance",
                        items: []
                    },
                    {
                        type: "row",
                        classList: ["background"],
                        items: [
                            {
                                type: "range",
                                title: "Font size",
                                description: "Sets the terminal font size",
                                id: "setting_terminalFontSize",
                                min: 10,
                                max: 24,
                                value: 14,
                                step: 1,
                                prefix: "px",
                                disabled: true
                            },
                            {
                                type: "switch",
                                title: "Cursor blink",
                                description: "Enables cursor blinking animation in the terminal",
                                id: "setting_terminalCursorBlink",
                                disabled: true
                            },
                        ]
                    },
                    {
                        type: "category",
                        label: "Behaviour",
                        items: []
                    },
                    {
                        type: "row",
                        classList: ["background"],
                        items: [
                            {
                                type: "switch",
                                title: "Copy on selection",
                                description: "Copies selected text to the clipboard automatically",
                                id: "setting_terminalCopyOnSelect",
                                disabled: true
                            }
                        ]
                    }
                ]
            },
            {
                name: lgls("fileWindowCategory"),
                icon: "tab",
                content: [
                    {
                        type: "category",
                        label: "Tabs",
                        items: []
                    },
                    {
                        type: "row",
                        classList: ["background"],
                        items: [
                            {
                                type: "switch",
                                title: "Colored tabs",
                                description: "The bottom part of the active tab will glow in the color of the language",
                                id: "setting_coloredTabs"
                            },
                            {
                                type: "switch",
                                title: "Show tab close button",
                                description: "Displays the X close button on editor tabs",
                                id: "setting_tabShowClose",
                                disabled: true
                            }
                        ]
                    }
                ]
            },
            {
                name: lgls("editorCategory"),
                icon: "code",
                content: [
                    {
                        type: "category",
                        label: lgls("editor.editorLabel"),
                        items: []
                    },
                    {
                        type: "row",
                        classList: ["background"],
                        items: [
                            {
                                type: "range",
                                title: lgls("editor.textSize.title"),
                                description: lgls("editor.textSize.description"),
                                id: "setting_editorTextSize",
                                min: 50,
                                max: 200,
                                value: 100,
                                step: 10,
                                prefix: "%"
                            },
                            {
                                type: "switch",
                                title: lgls("editor.smoothScroll.title"),
                                description: lgls("editor.smoothScroll.description"),
                                id: "setting_smoothScroll",
                                note: gls.get("modals.needToReloadNote")
                            },
                            {
                                type: "placeholder",
                                title: lgls("editor.pythonRunner.title"),
                                description: lgls("editor.pythonRunner.description"),
                                id: "setting_pythonRunMethod",
                                disabled: platform != "win32",
                                note: platform == "win32" ? gls.get("modals.needToReloadNote") : `${lgls("editor.builtInPythonCausePlatformNote", { platform: platform.toUpperCase() })}`
                            }
                        ]
                    }
                ]
            }
        ]
    })

    return appearanceModal
}