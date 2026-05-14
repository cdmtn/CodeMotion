const { app, ipcMain } = require("electron")

function callback(data) {
    const activeRules = new Set()
    const cb = data.selfArgs[0]
    const mainSender = data.mainSender

    if (typeof cb == "function") {
        ipcMain.on("ace-changed-event", (_, data) => {
            cb(
                {
                    value: data.editorValue,
                    mode: data.editorMode,
                    language: {
                        name: data.editorLanguage,
                        extension: data.editorLanguageExtension
                    },
                    cursor: data.cursor || {
                        line: 1,
                        column: 1
                    },
                    hl: {
                        addRule: addRule,
                        removeRule: removeRule
                    }
                }
            )
        })
    }

    function addRule(id, object = {}) {
        if (activeRules.has(id)) return

        if (!object || typeof object !== "object" || Array.isArray(object)) {
            return
        }

        const data = {}
        data["action"] = "add"
        data["id"] = id
        data["rule"] = object

        mainSender.send("on-editor-change-new-hl-rules", data)
    }
    function removeRule(id) {
        if (activeRules.has(id)) return

        const data = {}
        data["action"] = "add"
        data["id"] = id

        mainSender.send("on-editor-change-new-hl-rules", data)
    }
}

module.exports = { callback }