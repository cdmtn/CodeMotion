const { exec } = require("child_process")
const path = require("path")

let cached = { title: "", artist: "", albumTitle: "", status: "None", duration: 0, position: 0 }

const psScript = path.join(__dirname, "getMediaInfo.ps1")

function refresh() {
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScript}"`, { timeout: 5000 }, (err, stdout) => {
        if (err || !stdout) {
            cached = { title: "", artist: "", albumTitle: "", status: "None", duration: 0, position: 0 }
            return
        }

        try {
            const data = JSON.parse(stdout.trim())
            cached = {
                title: data.Title || "",
                artist: data.Artist || "",
                albumTitle: data.AlbumTitle || "",
                status: data.Status || "None",
                duration: data.Duration || 0,
                position: data.Position || 0
            }
        } catch (e) {
            cached = { title: "", artist: "", albumTitle: "", status: "None", duration: 0, position: 0 }
        }
    })
}

refresh()
setInterval(refresh, 3000)

function callback(data) {
    return function () {
        return { ...cached }
    }
}

module.exports = { callback }
