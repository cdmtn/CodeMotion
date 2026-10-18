const { execFileP, parseCommand, resolveAllowedCommand, sanitizeRunOptions } = require("./_common.js")

function callback(data) {
    return async (...args) => {
        const command = args[0]
        const options = args[1] || {}

        if (typeof command !== "string" || command.length === 0) {
            throw new Error("[shell.run] First argument must be a non-empty command string")
        }

        const argv = parseCommand(command)
        const file = resolveAllowedCommand(argv[0])
        const runOptions = sanitizeRunOptions(options, {
            timeout: 30000,
            maxBuffer: 1024 * 1024
        })

        try {
            const { stdout, stderr } = await execFileP(file, argv.slice(1), {
                encoding: runOptions.encoding,
                timeout: runOptions.timeout,
                maxBuffer: runOptions.maxBuffer,
                cwd: runOptions.cwd,
                env: runOptions.env,
                shell: false,
                windowsHide: true,
                killSignal: "SIGKILL"
            })

            return { stdout, stderr, ok: true }
        } catch (err) {
            return {
                stdout: err.stdout || "",
                stderr: err.stderr || err.message,
                ok: false,
                code: typeof err.code === "number" ? err.code : err.status
            }
        }
    }
}

module.exports = { callback }
