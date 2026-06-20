const { saveReadFile, createSandboxConsole, checkFields, resolveSandboxPath } = require("../../tools.js")

function callback(data) {
    const langName = data.selfArgs[0]
    const configPath = data.selfArgs[1]
    const extPath = data.extensionPath
    const extName = data.extensionName
    const permName = data.permissionName
    const mainSender = data.mainSender
    const debuggerSender = data.debuggerSender

    const c = createSandboxConsole(extName, debuggerSender)

    if(!langName) {
        c.error(`[${permName}] Each language must have a unique name-id. For example: en`)
        return
    }

    if(configPath) {
        let configContent = saveReadFile(resolveSandboxPath(extPath, configPath + ".json"))
        configContent = JSON.parse(configContent)

        if(!configContent) {
            c.error(`[${permName}] Config "${configPath}.json" is empty or not exists`)
            return
        }
        else {
            try {
                checkFields(`${permName}:config`, configContent, {
                    name: "string"
                })

                mainSender.send("extension-localization-register", { langName, configContent, from: extName })
            }
            catch(e) {
                c.error(String(e))
            }
        }
    }
    else {
        c.error(`[${permName}] The language configuration must be the second argument after the name-id`)
        return 
    }

    return () => {}
}

module.exports = { callback }