export function fileWindowPage({ lgls }) {
    return {
        name: lgls("fileWindowCategory"),
        icon: "tab",
        content: [
            {
                type: "category",
                label: lgls("fileWindow.tabsCategory"),
                items: []
            },
            {
                type: "row",
                classList: ["background"],
                items: [
                    {
                        type: "switch",
                        title: lgls("fileWindow.title"),
                        description: lgls("fileWindow.description"),
                        id: "setting_coloredTabs"
                    },
                    {
                        type: "switch",
                        title: lgls("fileWindow.showCloseButton.title"),
                        description: lgls("fileWindow.showCloseButton.description"),
                        id: "setting_tabShowClose",
                        disabled: true
                    },
                    {
                        type: "switch",
                        title: lgls("fileWindow.confirmClose.title"),
                        description: lgls("fileWindow.confirmClose.description"),
                        id: "setting_confirmCloseTab"
                    }
                ]
            }
        ]
    }
}
