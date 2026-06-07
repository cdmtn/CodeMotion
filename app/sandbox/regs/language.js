const { app, ipcMain } = require("electron")
const { checkFields, saveReadFile, isFileExists } = require("../tools")
const path = require("path")
const bus = require("../../../helpers/eventBus")

let debuggerSender = null
let mainSender = null

bus.on("debugger-ready", (sender) => {
    debuggerSender = sender;
});
bus.on("main-ready", (sender) => {
    mainSender = sender;
});

ipcMain.on("language-register", async (event, data) => {
    const configPath = data.configPath
    const extPath = data.extensionPath
    const extName = data.extensionName

    if (configPath) {
        let configContent = saveReadFile(path.join(extPath, configPath + ".json"), true)
        configContent = JSON.parse(configContent)

        checkFields(`language.register:config`, configContent, {
            name: "string",
            displayName: "string",
            extensions: "array",
            rules: "string"
        })

        let rulesConfig = saveReadFile(path.join(extPath, configContent.rules + ".json"), true)
        rulesConfig = JSON.parse(rulesConfig)

        checkFields(`language.register:config:rules`, rulesConfig, {
            syntax: "object",
            autocomplete: "object"
        })

        let iconPath = false
        const defaultIcon = path.join(app.getAppPath(), "assets", "media", "icons", "default.svg")

        if ("icon" in configContent) {
            checkFields(`language.register:config`, configContent, {
                icon: "SVGFile|PNGFile"
            })

            iconPath = path.join(extPath, configContent.icon)
            isFileExists(iconPath, true)
        }
        else {
            iconPath = defaultIcon

            for (const e of configContent.extensions) {
                let extIconPath = path.join(app.getAppPath(), "assets", "media", "icons", `${e}.svg`)

                if (isFileExists(extIconPath)) {
                    iconPath = extIconPath
                    break
                }
            }
        }

        const dataToSend = {
            languageName: configContent.name,
            languageDisplayName: configContent.displayName,
            languageExtensions: configContent.extensions,
            languageRules: rulesConfig,
            languageIconPath: iconPath
        }

        if ("documentation" in configContent) {
            let documentationConfig = saveReadFile(path.join(extPath, configContent.documentation + ".json"), true)
            documentationConfig = JSON.parse(documentationConfig)

            dataToSend["languageDocumentation"] = documentationConfig
        }

        mainSender.send("on-language-register", dataToSend)

        debuggerSender.send("debug-event", {
            data: {
                type: "msg",
                content: `Added new language: ${configContent.name}`,
                from: extName
            },
            time: Date.now()
        })
    }
    else {
        throw new Error(`[language.register] You must specify the configuration for language registration`)
    }
})