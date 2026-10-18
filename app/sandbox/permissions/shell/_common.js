const { execFile } = require("child_process")
const { promisify } = require("util")
const fs = require("fs")
const os = require("os")
const path = require("path")

// Shared hardening for the shell permissions.

const execFileP = promisify(execFile)

const MAX_TIMEOUT = 10 * 60 * 1000
const MAX_BUFFER = 25 * 1024 * 1024

const ALLOWED_ENCODINGS = new Set([
    "utf-8", "utf8", "latin1", "ascii", "hex", "base64", "ucs-2", "ucs2", "utf16le"
])

const ENV_ALLOWLIST = new Set([
    "PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "LANGUAGE", "LC_ALL",
    "LC_CTYPE", "LC_MESSAGES", "TERM",
    "TMP", "TEMP", "TMPDIR",
    "SYSTEMROOT", "SYSTEMDRIVE", "COMSPEC", "PATHEXT", "WINDIR", "HOMEDRIVE",
    "HOMEPATH", "USERPROFILE", "PUBLIC", "PROGRAMDATA", "APPDATA",
    "LOCALAPPDATA", "PROGRAMFILES", "PROGRAMFILES(X86)",
    "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE", "PROCESSOR_IDENTIFIER", "OS"
])

const BLOCKED_ENV_KEYS = new Set([
    "LD_PRELOAD", "LD_LIBRARY_PATH", "LD_AUDIT", "NODE_OPTIONS", "BASH_ENV",
    "ENV", "IFS", "PS4", "PROMPT_COMMAND"
])

const DEFAULT_ALLOWED_COMMANDS = new Set([
    // version control, runtimes and package managers
    "git", "node", "npm", "npx", "yarn", "pnpm", "bun", "deno", "tsc",
    "python", "python2", "python3", "pip", "pip2", "pip3", "uv",
    "ruby", "gem", "rustc", "cargo", "go", "java", "javac", "mvn", "gradle",
    "dotnet", "php", "composer", "perl", "lua",
    // build tools
    "make", "cmake", "ninja", "gcc", "g++", "cc", "clang", "clang++",
    "eslint", "prettier",
    // read-only / informational commands
    "echo", "printf", "cat", "ls", "dir", "pwd", "whoami", "id", "groups",
    "uname", "hostname", "date", "uptime", "df", "du", "free", "env", "ver",
    "where", "which", "tasklist", "systeminfo", "sw_vers", "ps", "stat",
    "file", "wc", "head", "tail", "sort", "uniq", "grep", "egrep", "fgrep",
    "diff", "md5sum", "sha1sum", "sha256sum", "shasum"
])

function getAllowlistFilePath() {
    try {
        const { app } = require("electron")
        if (app && typeof app.getPath === "function") {
            return path.join(app.getPath("userData"), "shell-allowlist.json")
        }
    } catch (e) { }
    return null
}

const ALLOWLIST_CACHE_TTL = 5000
let allowlistCache = null

function normalizeCommandName(name) {
    let normalized = String(name).trim()
    if (os.platform() === "win32") {
        normalized = normalized.replace(/\.exe$/i, "")
    }
    return normalized
}

function getUserAllowlist() {
    const now = Date.now()

    if (allowlistCache && now - allowlistCache.time < ALLOWLIST_CACHE_TTL) {
        return allowlistCache
    }

    const allow = new Set(DEFAULT_ALLOWED_COMMANDS)
    const deny = new Set()

    const filePath = getAllowlistFilePath()
    if (filePath) {
        try {
            const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"))
            const allowEntries = Array.isArray(parsed) ? parsed : parsed.allow
            const denyEntries = Array.isArray(parsed) ? [] : parsed.deny

            if (Array.isArray(allowEntries)) {
                for (const name of allowEntries) {
                    if (typeof name === "string" && name.length > 0 && name.length <= 128) {
                        allow.add(normalizeCommandName(name))
                    }
                }
            }

            if (Array.isArray(denyEntries)) {
                for (const name of denyEntries) {
                    if (typeof name === "string" && name.length > 0 && name.length <= 128) {
                        deny.add(normalizeCommandName(name))
                    }
                }
            }
        } catch (e) { }
    }

    allowlistCache = { time: now, allow, deny }
    return allowlistCache
}

const UNSAFE_CHARS = /[;&|<>`\n\r\0]/

function parseCommand(command) {
    if (typeof command !== "string" || command.trim().length === 0) {
        throw new Error("[shell] First argument must be a non-empty command string")
    }

    const argv = []
    let current = ""
    let quote = null
    let hasToken = false

    for (let i = 0; i < command.length; i++) {
        const ch = command[i]

        if (quote !== null) {
            if (ch === quote) {
                quote = null
                hasToken = true
                continue
            }
            if (ch === "\n" || ch === "\r" || ch === "\0") {
                throw new Error("[shell] Command contains forbidden control characters")
            }
            current += ch
            hasToken = true
            continue
        }

        if (ch === "'" || ch === "\"") {
            quote = ch
            hasToken = true
            continue
        }

        if (ch === "\n" || ch === "\r" || ch === "\0") {
            throw new Error("[shell] Command contains forbidden control characters")
        }

        if (/\s/.test(ch)) {
            if (hasToken) {
                argv.push(current)
                current = ""
                hasToken = false
            }
            continue
        }

        if (UNSAFE_CHARS.test(ch)) {
            throw new Error(
                `[shell] Command contains forbidden shell metacharacter "${ch}" — ` +
                "commands are executed without a shell, chaining and substitution are not supported"
            )
        }

        current += ch
        hasToken = true
    }

    if (quote !== null) {
        throw new Error("[shell] Command contains an unterminated quote")
    }

    if (hasToken) {
        argv.push(current)
    }

    if (argv.length === 0) {
        throw new Error("[shell] First argument must be a non-empty command string")
    }

    return argv
}

function resolveAllowedCommand(command) {
    const raw = String(command)

    if (raw.length === 0 || raw.length > 256) {
        throw new Error("[shell] Command name is empty or too long")
    }

    if (raw.includes("/") || raw.includes("\\") || raw.includes("..") || raw.startsWith("-")) {
        throw new Error(
            "[shell] Only bare command names are allowed (no paths, no arguments in the executable position)"
        )
    }

    const name = normalizeCommandName(raw)
    const { allow, deny } = getUserAllowlist()

    if (deny.has(name)) {
        throw new Error(`[shell] Command "${name}" is blocked by the shell-allowlist.json deny list`)
    }

    if (!allow.has(name)) {
        const filePath = getAllowlistFilePath()
        const hint = filePath
            ? `Add it to "${filePath}" to allow it.`
            : "Ask the app user to allow it via shell-allowlist.json."
        throw new Error(`[shell] Command "${name}" is not in the allowed commands list. ${hint}`)
    }

    return name
}

function buildSafeEnv(customEnv) {
    const env = {}

    for (const [key, value] of Object.entries(process.env)) {
        if (typeof value === "string" && ENV_ALLOWLIST.has(key.toUpperCase())) {
            env[key] = value
        }
    }

    if (customEnv !== null && typeof customEnv === "object" && !Array.isArray(customEnv)) {
        for (const [key, value] of Object.entries(customEnv)) {
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
            if (BLOCKED_ENV_KEYS.has(key.toUpperCase())) continue
            if (typeof value === "string" || typeof value === "number") {
                env[key] = String(value)
            }
        }
    }

    return env
}

function sanitizeRunOptions(options, defaults) {
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
        options = {}
    }

    let timeout = Number(options.timeout)
    if (!Number.isFinite(timeout) || timeout <= 0) {
        timeout = defaults.timeout
    }
    timeout = Math.min(Math.floor(timeout), MAX_TIMEOUT)

    let maxBuffer = Number(options.maxBuffer)
    if (!Number.isFinite(maxBuffer) || maxBuffer <= 0) {
        maxBuffer = defaults.maxBuffer
    }
    maxBuffer = Math.min(Math.floor(maxBuffer), MAX_BUFFER)

    let encoding = "utf-8"
    if (typeof options.encoding === "string" && ALLOWED_ENCODINGS.has(options.encoding.toLowerCase())) {
        encoding = options.encoding
    }

    let cwd
    if (typeof options.cwd === "string" && options.cwd.trim().length > 0 && options.cwd.length < 4096) {
        cwd = options.cwd
    }

    return {
        timeout,
        maxBuffer,
        encoding,
        cwd,
        env: buildSafeEnv(options.env)
    }
}

function isCriticalPid(pid) {
    return pid === 0 || pid === 1 || pid === 4 || pid === process.pid
}

function getLinuxPpid(pid) {
    try {
        const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf-8")
        const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ")
        const ppid = Number.parseInt(fields[1], 10)
        return Number.isSafeInteger(ppid) && ppid > 0 ? ppid : null
    } catch (e) {
        return null
    }
}

async function getProtectedPids() {
    const protectedPids = new Set([process.pid])
    const platform = os.platform()

    let current = process.ppid
    let depth = 0

    while (Number.isSafeInteger(current) && current > 1 && depth < 20 && !protectedPids.has(current)) {
        protectedPids.add(current)
        depth++

        if (platform === "linux") {
            const ppid = getLinuxPpid(current)
            if (ppid === null) break
            current = ppid
        } else if (platform === "darwin") {
            try {
                const { stdout } = await execFileP("ps", ["-o", "ppid=", "-p", String(current)], {
                    encoding: "utf-8",
                    timeout: 5000,
                    windowsHide: true
                })
                const ppid = Number.parseInt(String(stdout).trim(), 10)
                if (!Number.isSafeInteger(ppid) || ppid <= 1) break
                current = ppid
            } catch (e) {
                break
            }
        } else {
            break
        }
    }

    return protectedPids
}

module.exports = {
    execFileP,
    parseCommand,
    resolveAllowedCommand,
    buildSafeEnv,
    sanitizeRunOptions,
    isCriticalPid,
    getProtectedPids,
    getAllowlistFilePath
}
