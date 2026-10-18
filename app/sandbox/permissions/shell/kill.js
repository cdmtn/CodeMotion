const os = require("os")
const { execFileP, isCriticalPid, getProtectedPids } = require("./_common.js")

const SAFE_PROCESS_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._+\-:]*$/

function callback(data) {
    return async (...args) => {
        const target = args[0]
        const force = args[1] === true

        if (target === undefined || target === null) {
            throw new Error("[shell.kill] First argument must be a process ID (number) or process/exe name (string)")
        }

        const platform = os.platform()
        const signal = force ? "SIGKILL" : "SIGTERM"

        try {
            if (typeof target === "number" || (typeof target === "string" && /^\d+$/.test(target))) {
                const pid = Number(target)

                if (!Number.isSafeInteger(pid) || pid <= 0) {
                    throw new Error("[shell.kill] Process ID must be a positive number")
                }

                if (isCriticalPid(pid)) {
                    throw new Error(`[shell.kill] Refusing to kill protected process ${pid}`)
                }

                const protectedPids = await getProtectedPids()
                if (protectedPids.has(pid)) {
                    throw new Error(
                        `[shell.kill] Refusing to kill process ${pid} — it is the application or one of its parents`
                    )
                }

                if (platform === "win32") {
                    const taskkillArgs = ["/PID", String(pid)]
                    if (force) taskkillArgs.push("/F")

                    await execFileP("taskkill", taskkillArgs, {
                        encoding: "utf-8",
                        stdio: "pipe",
                        timeout: 10000,
                        windowsHide: true
                    })
                } else {
                    process.kill(pid, signal)
                }

                return { ok: true, pid }
            }

            const name = String(target)

            if (name.length === 0 || name.length > 256 || !SAFE_PROCESS_NAME.test(name)) {
                throw new Error("[shell.kill] Process name contains unsupported characters")
            }

            if (platform === "win32") {
                const taskkillArgs = ["/IM", name]
                if (force) taskkillArgs.push("/F")

                await execFileP("taskkill", taskkillArgs, {
                    encoding: "utf-8",
                    stdio: "pipe",
                    timeout: 10000,
                    windowsHide: true
                })

                return { ok: true, name }
            }

            let stdout = ""

            try {
                ({ stdout } = await execFileP("pgrep", ["-f", name], {
                    encoding: "utf-8",
                    stdio: "pipe",
                    timeout: 10000
                }))
            } catch (err) {
                if (err.code === 1) {
                    return { ok: false, error: `No process found matching "${name}"`, name }
                }
                throw err
            }

            const protectedPids = await getProtectedPids()
            const pids = String(stdout)
                .split("\n")
                .map(pid => Number.parseInt(pid.trim(), 10))
                .filter(pid =>
                    Number.isSafeInteger(pid) &&
                    pid > 4 &&
                    !isCriticalPid(pid) &&
                    !protectedPids.has(pid)
                )

            if (pids.length === 0) {
                return { ok: false, error: `No process found matching "${name}"`, name }
            }

            pids.forEach(pid => {
                try { process.kill(pid, signal) } catch { }
            })

            return { ok: true, name, pids }
        } catch (err) {
            return { ok: false, error: err.message, target: String(target) }
        }
    }
}

module.exports = { callback }
