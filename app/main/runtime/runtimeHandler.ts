import { ipcMain, IpcMainInvokeEvent, app } from "electron"
import { spawn, ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from "node:child_process"
import fs from "fs"
import path from "node:path"
import { RunPythonPayload } from "../payloads"

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

const getSystemPythonCommands = (): string[] => {
    if (process.platform === "win32") {
        return ["python", "python3", "py"]
    }

    return ["python3", "python"]
}

const spawnPython = (
    command: string,
    args: string[],
    options: SpawnOptionsWithoutStdio
): Promise<ChildProcessWithoutNullStreams> => {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, options) as ChildProcessWithoutNullStreams

        const handleSpawn = (): void => {
            child.removeListener("error", handleError)
            resolve(child)
        }

        const handleError = (error: Error): void => {
            child.removeListener("spawn", handleSpawn)
            reject(error)
        }

        child.once("spawn", handleSpawn)
        child.once("error", handleError)
    })
}

ipcMain.handle(
    "run-python-code",
    async (
        _: IpcMainInvokeEvent,
        data: RunPythonPayload
    ): Promise<RunPythonResult> => {
        let runPath: string
        let isTempFile = false

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

        try {
            if (filePath) {
                if (!fs.existsSync(filePath)) {
                    return {
                        type: "file_not_found",
                        result: `File not found: ${filePath}`
                    }
                }

                runPath = filePath
            } else if (code) {
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true })
                }

                runPath = path.join(tempDir, `temp-${Date.now()}.py`)
                fs.writeFileSync(runPath, code, "utf8")
                isTempFile = true
            } else {
                return {
                    type: "no_input",
                    result: "No code or filePath provided"
                }
            }

            const spawnOptions: SpawnOptionsWithoutStdio = {
                cwd: path.dirname(runPath)
            }

            const candidates = useEmbed && fs.existsSync(embeddedPy)
                ? [embeddedPy]
                : getSystemPythonCommands()

            let py: ChildProcessWithoutNullStreams | null = null
            let pyCommand = ""

            for (const command of candidates) {
                try {
                    py = await spawnPython(command, [runPath], spawnOptions)
                    pyCommand = command
                    break
                } catch {
                    continue
                }
            }

            if (!py) {
                cleanup()
                return {
                    type: "python_not_found",
                    result: useEmbed
                        ? "Embedded Python not found"
                        : "System Python not found"
                }
            }

            let stdout = ""
            let stderr = ""

            const result = await new Promise<RunPythonResult>((resolve) => {
                let settled = false
                let timeout: NodeJS.Timeout | null = null

                const settle = (value: RunPythonResult): void => {
                    if (settled) return
                    settled = true

                    if (timeout) {
                        clearTimeout(timeout)
                    }

                    resolve(value)
                }

                timeout = setTimeout(() => {
                    py?.kill()

                    settle({
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
                    settle({
                        type: "spawn_error",
                        result: "Failed to start Python process"
                    })
                })

                py.on("close", (exitCode: number | null) => {
                    settle({
                        type: exitCode === 0 ? "success" : "error",
                        stdout,
                        stderr,
                        exitCode: exitCode ?? -1,
                        file: runPath,
                        interpreter: pyCommand
                    })
                })
            })

            cleanup()
            return result
        } catch (err: unknown) {
            cleanup()

            const message =
                err instanceof Error ? err.message : String(err)

            return {
                type: "internal_error",
                result: message
            }
        }
    }
)
