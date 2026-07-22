const { execSync } = require("child_process")
const os = require("os")

function callback(data) {
    return (...args) => {
        const target = args[0]
        const force = args[1] || false

        if (target === undefined || target === null) {
            throw new Error("[shell.kill] First argument must be a process ID (number) or process/exe name (string)")
        }

        const platform = os.platform()

        try {
            if (typeof target === "number" || (typeof target === "string" && /^\d+$/.test(target))) {
                const pid = Number(target)
                if (pid <= 0) throw new Error("[shell.kill] Process ID must be a positive number")

                if (platform === "win32") {
                    const cmd = force ? `taskkill /PID ${pid} /F` : `taskkill /PID ${pid}`
                    execSync(cmd, { encoding: "utf-8", stdio: "pipe" })
                } else {
                    process.kill(pid, force ? "SIGKILL" : "SIGTERM")
                }

                return { ok: true, pid }
            }

            const name = String(target)

            if (platform === "win32") {
                const cmd = force
                    ? `taskkill /IM "${name}" /F`
                    : `taskkill /IM "${name}"`
                execSync(cmd, { encoding: "utf-8", stdio: "pipe" })
                return { ok: true, name }
            } else {
                const signal = force ? "SIGKILL" : "SIGTERM"
                const result = execSync(`pgrep -f "${name}"`, { encoding: "utf-8", stdio: "pipe" }).trim()
                const pids = result.split("\n").filter(Boolean).map(Number)

                if (pids.length === 0) {
                    return { ok: false, error: `No process found matching "${name}"`, name }
                }

                pids.forEach(pid => {
                    try { process.kill(pid, signal) } catch {}
                })

                return { ok: true, name, pids }
            }
        } catch (err) {
            return { ok: false, error: err.message, target: String(target) }
        }
    }
}

module.exports = { callback }
