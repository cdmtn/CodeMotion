const { saveReadFile } = require("../tools.js")
const path = require("path")

function callback(data) {
    const extName = data.extensionName
    const notificationData = data.selfArgs[0]

    data.mainSender.send("extension-notification", extName, notificationData)
}

module.exports = { callback }