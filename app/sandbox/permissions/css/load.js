const { saveReadFile, resolveSandboxPath } = require("../../tools.js")

function callback(data) {
    const extName = data.extensionName
    const extPath = data.extensionPath
    const filename = data.selfArgs[0] + ".css"
    const CSSContent = saveReadFile(resolveSandboxPath(extPath, filename))

    if (!CSSContent) throw new Error(`The file "${filename}" was not found or is empty`)

    data.debuggerSender.send("debug-event", {
        data: {
            type: "warn",
            content: `Loaded local resource: ${filename}`,
            from: extName
        },
        time: Date.now()
    })

    data.mainSender.send("load-css", extName, CSSContent)
}

module.exports = { callback }