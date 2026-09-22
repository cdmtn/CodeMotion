export function editorPage({ lgls, gls, platform }) {
    return {
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
                        type: "placeholder",
                        title: lgls("editor.pythonRunner.title"),
                        description: lgls("editor.pythonRunner.description"),
                        id: "setting_pythonRunMethod",
                        disabled: platform != "win32",
                        note: platform == "win32" ? gls.get("modals.needToReloadNote") : `${lgls("editor.builtInPythonCausePlatformNote", { platform: platform.toUpperCase() })}`
                    }
                ]
            },
            {
                type: "category",
                label: lgls("editor.contextsLabel"),
                items: []
            },
            {
                type: "row",
                classList: ["background"],
                items: [
                    {
                        type: "switch",
                        title: lgls("editor.contexts.go.title"),
                        description: lgls("editor.contexts.go.description"),
                        id: "setting_go_context_parser"
                    },
                ]
            },
            {
                type: "category",
                label: lgls("editor.autosaves"),
                items: []
            },
            {
                type: "row",
                classList: ["background"],
                items: [
                    {
                        type: "placeholder",
                        title: lgls("editor.autosave.title"),
                        description: lgls("editor.autosave.description"),
                        id: "setting_autosave"
                    },
                ]
            }
        ]
    }
}
