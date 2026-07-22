const { execSync } = require("child_process")

function callback(data) {
    return (...args) => {
        const command = args[0]
        const options = args[1] || {}

        if (typeof command !== "string" || command.length === 0) {
            throw new Error("[shell.run] First argument must be a non-empty command string")
        }

        try {
            const result = execSync(command, {
                encoding: options.encoding || "utf-8",
                timeout: options.timeout || 30000,
                maxBuffer: options.maxBuffer || 1024 * 1024,
                cwd: options.cwd || undefined,
                env: options.env || process.env,
                shell: options.shell || true
            })

            return { stdout: result, stderr: "", ok: true }
        } catch (err) {
            return {
                stdout: err.stdout || "",
                stderr: err.stderr || err.message,
                ok: false,
                code: err.status
            }
        }
    }
}

module.exports = { callback }
