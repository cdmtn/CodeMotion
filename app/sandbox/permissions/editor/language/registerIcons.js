const { saveReadFile, log, resolveSandboxPath } = require("../../../tools.js")

function callback(data) {
    const extPath = data.extensionPath
    const configPath = data.selfArgs[0]

    if (configPath) {
        let configContent = saveReadFile(resolveSandboxPath(extPath, configPath + ".json"), true)
        configContent = JSON.parse(configContent)

        Object.keys(configContent).forEach(k => {
            configContent[k] = resolveSandboxPath(extPath, configContent[k].icon)
        })

        data.mainSender.send("new-language-icons-register", configContent)
    }
}

module.exports = { callback }