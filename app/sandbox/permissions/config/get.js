const fs = require("fs")
const path = require("path")

function callback(data) {
    const extensionPath = data.extensionPath
    const configPath = path.join(extensionPath, "config.json")

    return () => {
        try {
            if (fs.existsSync(configPath)) {
                return JSON.parse(fs.readFileSync(configPath, "utf-8"))
            }
        } catch (e) {}
        return {}
    }
}

module.exports = { callback }
