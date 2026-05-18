const { execFile } = require("child_process")

const DEFAULT_TIMEOUT = 30000
const DEFAULT_MAX_BUFFER = 1024 * 1024 * 24

function normalizeExecError(error, stderr) {
    if (!error) return null

    if (error.code === "ENOENT") {
        return "Git is not installed or is not available in PATH"
    }

    return (stderr || error.message || String(error)).trim()
}

function runGit(cwd, args, options = {}) {
    return new Promise((resolve) => {
        execFile(
            "git",
            args,
            {
                cwd,
                timeout: options.timeout ?? DEFAULT_TIMEOUT,
                maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER,
                windowsHide: true
            },
            (error, stdout, stderr) => {
                const result = {
                    success: !error,
                    stdout: stdout || "",
                    stderr: stderr || "",
                    error: normalizeExecError(error, stderr),
                    code: error?.code ?? 0
                }

                if (options.allowFailure) {
                    resolve(result)
                    return
                }

                resolve(result)
            }
        )
    })
}

async function assertGitAvailable(cwd) {
    const result = await runGit(cwd, ["--version"])

    if (!result.success) {
        throw new Error(result.error || "Git is not available")
    }

    return result.stdout.trim()
}

async function getRepositoryRoot(cwd) {
    const result = await runGit(cwd, ["rev-parse", "--show-toplevel"])

    if (!result.success) {
        throw new Error("Current project is not a Git repository")
    }

    return result.stdout.trim()
}

module.exports = {
    runGit,
    assertGitAvailable,
    getRepositoryRoot
}
