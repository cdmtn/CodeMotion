const { exec } = require("child_process")

function callback(data) {
    return (...args) => {
        const command = args[0]
        const options = args[1] || {}
        const onData = args[2] || null

        if (typeof command !== "string" || command.length === 0) {
            throw new Error("[shell.exec] First argument must be a non-empty command string")
        }

        return new Promise((resolve) => {
            const proc = exec(command, {
                encoding: options.encoding || "utf-8",
                timeout: options.timeout || 60000,
                maxBuffer: options.maxBuffer || 1024 * 1024 * 5,
                cwd: options.cwd || undefined,
                env: options.env || process.env,
                shell: options.shell || true
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
