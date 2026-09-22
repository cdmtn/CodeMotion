export function generalPage({ lgls, gls }) {
    return {
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
                        type: "switch",
                        title: lgls("application.restoreFolder.title"),
                        description: lgls("application.restoreFolder.description"),
                        id: "setting_restoreFolder"
                    },
                    {
                        type: "switch",
                        title: lgls("application.useSystemNotifications.title"),
                        description: lgls("application.useSystemNotifications.description"),
                        id: "setting_useSystemNotifications"
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
    }
}
