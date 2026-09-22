export function sidebarPage({ lgls }) {
    return {
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
                        title: lgls("sideBar.showHiddenFiles.title"),
                        description: lgls("sideBar.showHiddenFiles.description"),
                        id: "setting_sidebarShowHiddenFiles",
                        disabled: true
                    }
                ]
            }
        ]
    }
}
