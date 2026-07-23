const fs = require("fs")
const path = require("path")

function callback(data) {
    const extensionPath = data.extensionPath
    const configPath = path.join(extensionPath, "config.json")

    return (newValues) => {
        if (!newValues || typeof newValues !== "object" || Array.isArray(newValues)) {
            throw new Error("[config.set] Argument must be a plain object")
        }

        let current = {}
        try {
            if (fs.existsSync(configPath)) {
                current = JSON.parse(fs.readFileSync(configPath, "utf-8"))
            }
        } catch (e) {}

        const merged = { ...current, ...newValues }
        fs.writeFileSync(configPath, JSON.stringify(merged, null, 4), "utf-8")
        return merged
    }
}

module.exports = { callback }
