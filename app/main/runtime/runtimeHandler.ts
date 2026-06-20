import { ipcMain, IpcMainInvokeEvent, app } from "electron"
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process"
import fs from "fs"
import path from "node:path"
import { RunPythonPayload } from "../payloads"

const BLOCKED_PYTHON_PATTERNS = [
    /\b__import__\b/,
    /\bimport\s+os\b/,
    /\bimport\s+subprocess\b/,
    /\bimport\s+sys\b/,
    /\bimport\s+socket\b/,
    /\bimport\s+urllib\b/,
    /\bimport\s+ftplib\b/,
    /\bimport\s+shutil\b/,
    /\bimport\s+pty\b/,
    /\bimport\s+multiprocessing\b/,
    /\bimport\s+threading\b/,
    /\bfrom\s+os\b/,
    /\bfrom\s+subprocess\b/,
    /\bfrom\s+sys\b/,
    /\bfrom\s+socket\b/,
    /\bfrom\s+urllib\b/,
    /\bfrom\s+ftplib\b/,
    /\bfrom\s+shutil\b/,
    /\bopen\s*\(/,
    /\bexec\s*\(/,
    /\beval\s*\(/,
    /\bcompile\s*\(/,
    /\binput\s*\(/,
    /\bgetattr\s*\(/,
    /\bsetattr\s*\(/,
    /\bdelattr\s*\(/,
]

function validatePythonCode(code: string): string | null {
    if (typeof code !== "string") return "Python code must be a string"
    if (code.length > 50000) return "Python code exceeds maximum length of 50000 characters"
    for (const pattern of BLOCKED_PYTHON_PATTERNS) {
        if (pattern.test(code)) {
            return `Forbidden Python pattern detected: ${pattern.source}`
        }
    }
    return null
}

type RunPythonResult =
    | {
        type: "file_not_found" | "no_input" | "python_not_found" | "timeout" | "spawn_error" | "internal_error"
        result: string
    }
    | {
        type: "success"
        stdout: string
        stderr: string
        exitCode: number
        file: string
        interpreter: string
    }
    | {
        type: "error"
        stdout: string
        stderr: string
        exitCode: number
        file: string
        interpreter: string
    }

ipcMain.handle(
    "run-python-code",
    (
        _: IpcMainInvokeEvent,
        data: RunPythonPayload
    ): Promise<RunPythonResult> => {
        return new Promise((resolve) => {
            let runPath: string
            let isTempFile = false
            let resolved = false

            const filePath = data.filePath
            const code = data.code
            const useEmbed = data.useEmbed

            const tempDir = path.join(app.getAppPath(), "temp")

            const embeddedPy = app.isPackaged
                ? path.join(process.resourcesPath, "runtime", "python", "python.exe")
                : path.join(__dirname, "..", "runtime", "python", "python.exe")

            const cleanup = (): void => {
                if (isTempFile && runPath && fs.existsSync(runPath)) {
                    try {
                        fs.unlinkSync(runPath)
                    } catch {}
                }
            }

            const finish = (result: RunPythonResult): void => {
                if (resolved) return
                resolved = true
                cleanup()
                resolve(result)
            }

            const trySpawn = (
                command: string,
                args: string[],
                options: any = {}
            ): ChildProcessWithoutNullStreams | null => {
                try {
                    return spawn(command, args, options)
                } catch {
                    return null
                }
            }

            try {
                if (filePath) {
                    if (!fs.existsSync(filePath)) {
                        return finish({
                            type: "file_not_found",
                            result: `File not found: ${filePath}`
                        })
                    }

                    runPath = filePath
                } else if (code) {
                    const validationError = validatePythonCode(code)
                    if (validationError) {
                        return finish({
                            type: "internal_error",
                            result: validationError
                        })
                    }

                    if (!fs.existsSync(tempDir)) {
                        fs.mkdirSync(tempDir, { recursive: true })
                    }

                    runPath = path.join(tempDir, `temp-${Date.now()}.py`)
                    fs.writeFileSync(runPath, code, "utf8")
                    isTempFile = true
                } else {
                    return finish({
                        type: "no_input",
                        result: "No code or filePath provided"
                    })
                }

                let pyCommand: string
                let pyArgs: string[] = [runPath]

                if (useEmbed) {
                    if (!fs.existsSync(embeddedPy)) {
                        return finish({
                            type: "python_not_found",
                            result: "Embedded Python not found"
                        })
                    }

                    pyCommand = embeddedPy
                } else {
                    pyCommand = "python"
                }

                let py = trySpawn(pyCommand, pyArgs, {
                    cwd: path.dirname(runPath)
                })

                if (!py && !useEmbed) {
                    pyCommand = "py"
                    py = trySpawn(pyCommand, pyArgs, {
                        cwd: path.dirname(runPath)
                    })
                }

                if (!py) {
                    return finish({
                        type: "python_not_found",
                        result: useEmbed
                            ? "Embedded Python not found"
                            : "System Python not found"
                    })
                }

                let stdout = ""
                let stderr = ""

                const timeout = setTimeout(() => {
                    py?.kill()

                    finish({
                        type: "timeout",
                        result: "Execution timed out"
                    })
                }, 10000)

                py.stdout.on("data", (data: Buffer) => {
                    stdout += data.toString()
                })

                py.stderr.on("data", (data: Buffer) => {
                    stderr += data.toString()
                })

                py.on("error", () => {
                    clearTimeout(timeout)

                    if (!useEmbed && pyCommand === "python") {
                        py = spawn("py", pyArgs, {
                            cwd: path.dirname(runPath)
                        })
                        return
                    }

                    finish({
                        type: "spawn_error",
                        result: "Failed to start Python process"
                    })
                })

                py.on("close", (exitCode: number | null) => {
                    clearTimeout(timeout)

                    finish({
                        type: exitCode === 0 ? "success" : "error",
                        stdout,
                        stderr,
                        exitCode: exitCode ?? -1,
                        file: runPath,
                        interpreter: pyCommand
                    })
                })

            } catch (err: unknown) {
                const message =
                    err instanceof Error ? err.message : String(err)

                finish({
                    type: "internal_error",
                    result: message
                })
            }
        })
    }
)