export function terminalPage({ lgls }) {
    return {
        name: lgls("terminalCategory"),
        icon: "terminal",
        content: [
            {
                type: "category",
                label: lgls("terminal.appearanceLabel"),
                items: []
            },
            {
                type: "row",
                classList: ["background"],
                items: [
                    {
                        type: "range",
                        title: lgls("terminal.fontSize.title"),
                        description: lgls("terminal.fontSize.description"),
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
                        title: lgls("terminal.cursorBlink.title"),
                        description: lgls("terminal.cursorBlink.description"),
                        id: "setting_terminalCursorBlink",
                        disabled: true
                    },
                ]
            },
            {
                type: "category",
                label: lgls("terminal.behaviourLabel"),
                items: []
            },
            {
                type: "row",
                classList: ["background"],
                items: [
                    {
                        type: "switch",
                        title: lgls("terminal.copyOnSelect.title"),
                        description: lgls("terminal.copyOnSelect.description"),
                        id: "setting_terminalCopyOnSelect",
                        disabled: true
                    }
                ]
            }
        ]
    }
}
