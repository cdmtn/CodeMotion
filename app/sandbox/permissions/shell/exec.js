const { execFile } = require("child_process")
const { parseCommand, resolveAllowedCommand, sanitizeRunOptions } = require("./_common.js")

function callback(data) {
    return (...args) => {
        const command = args[0]
        const options = args[1] || {}
        const onData = args[2] || null

        if (typeof command !== "string" || command.length === 0) {
            throw new Error("[shell.exec] First argument must be a non-empty command string")
        }

        const argv = parseCommand(command)
        const file = resolveAllowedCommand(argv[0])
        const runOptions = sanitizeRunOptions(options, {
            timeout: 60000,
            maxBuffer: 1024 * 1024 * 5
        })

        return new Promise((resolve) => {
            const proc = execFile(file, argv.slice(1), {
                encoding: runOptions.encoding,
                timeout: runOptions.timeout,
                maxBuffer: runOptions.maxBuffer,
                cwd: runOptions.cwd,
                env: runOptions.env,
                shell: false,
                windowsHide: true,
                killSignal: "SIGKILL"
            })

            let stdout = ""
            let stderr = ""

            proc.stdout.on("data", (chunk) => {
                stdout += chunk
                if (typeof onData === "function") {
                    onData({ type: "stdout", data: chunk.toString() })
                }
            })

            proc.stderr.on("data", (chunk) => {
                stderr += chunk
                if (typeof onData === "function") {
                    onData({ type: "stderr", data: chunk.toString() })
                }
            })

            proc.on("close", (code) => {
                resolve({ stdout, stderr, ok: code === 0, code })
            })

            proc.on("error", (err) => {
                resolve({ stdout, stderr: err.message, ok: false, code: -1 })
            })
        })
    }
}

module.exports = { callback }
