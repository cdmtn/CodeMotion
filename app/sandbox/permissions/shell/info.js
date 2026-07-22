const os = require("os")

function callback(data) {
    return (...args) => {
        const platform = os.platform()
        const arch = os.arch()

        const platformMap = {
            win32: "windows",
            darwin: "macos",
            linux: "linux",
            freebsd: "freebsd"
        }

        return {
            platform: platformMap[platform] || platform,
            platformRaw: platform,
            arch: arch,
            release: os.release(),
            hostname: os.hostname(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            homeDir: os.homedir(),
            tmpDir: os.tmpdir(),
            userInfo: {
                username: os.userInfo().username,
                uid: os.userInfo().uid
            }
        }
    }
}

module.exports = { callback }
