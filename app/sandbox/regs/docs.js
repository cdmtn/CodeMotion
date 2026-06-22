const { ipcMain } = require("electron")
const { checkFields, saveReadFile, resolveSandboxPath } = require("../tools")
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

ipcMain.on("docs-register", async (event, data) => {
    const configPath = data.configPath
    const extPath = data.extensionPath
    const extName = data.extensionName

    let documentationProperties = {}

    if (configPath) {
        let configContent = saveReadFile(resolveSandboxPath(extPath, configPath + ".json"), true)
        configContent = JSON.parse(configContent)

        const docPropertiesKey = "__$props__"

        if (Object.keys(configContent).length > 0) {
            // check $props and fields
            if(docPropertiesKey in configContent) {
                documentationProperties = configContent[docPropertiesKey]

                checkFields(`docs.register:config:${docPropertiesKey}`, documentationProperties, {
                    onMode: "string"
                })

                delete configContent[docPropertiesKey]
            }
            else {
                throw new Error(`docs.register: key "$props" in documentation config is required`)
            }

            // check each config item
            Object.keys(configContent).forEach((item, index) => {
                checkFields(`docs.register:config:${index}`, configContent[item], {
                    type: "string",
                    description: "string",
                    example: "string",
                    sources: "array"
                })
            })

            mainSender.send("new-documentation-register", {
                config: configContent,
                props: documentationProperties
            })
        }
    }
})