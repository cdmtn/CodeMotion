const { checkFields, saveReadFile, resolveSandboxPath } = require("../../../tools")

function callback(data) {
    const configPath = data.selfArgs[0]
    const extPath = data.extensionPath

    let documentationProperties = {}

    if (configPath) {
        let configContent = saveReadFile(resolveSandboxPath(extPath, configPath + ".json"), true)
        configContent = JSON.parse(configContent)

        const docPropertiesKey = "__$props__"

        if (Object.keys(configContent).length > 0) {
            // check $props and fields
            if(docPropertiesKey in configContent) {
                documentationProperties = configContent[docPropertiesKey]

                checkFields(`${data.permissionName}:config:${docPropertiesKey}`, documentationProperties, {
                    onMode: "string"
                })

                delete configContent[docPropertiesKey]
            }
            else {
                throw new Error(`${data.permissionName}: key "$props" in documentation config is required`)
            }

            // check each config item
            Object.keys(configContent).forEach((item, index) => {
                checkFields(`${data.permissionName}:config:${index}`, configContent[item], {
                    type: "string",
                    description: "string",
                    example: "string",
                    sources: "array"
                })
            })

            data.mainSender.send("new-documentation-register", {
                config: configContent,
                props: documentationProperties
            })
        }
    }
}

module.exports = { callback }