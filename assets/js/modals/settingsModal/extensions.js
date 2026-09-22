export function extensionsPage({ lgls }) {
    return {
        name: lgls("extensions.title"),
        icon: "extension",
        content: [
            {
                type: "category",
                label: lgls("extensions.securityCategory"),
                items: []
            },
            {
                type: "row",
                classList: ["background"],
                items: [
                    {
                        type: "switch",
                        title: lgls("extensions.riskyPermsWarn.title"),
                        description: lgls("extensions.riskyPermsWarn.description"),
                        id: "setting_disableRiskyPermissionWarning"
                    }
                ]
            }
        ]
    }
}
