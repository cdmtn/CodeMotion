import { describe, it, expect } from "vitest"
import fs from "fs"
import os from "os"

function detectShell() {
    if (process.platform === 'win32') {
        return 'cmd.exe';
    }

    const userShell = process.env.SHELL;

    if (userShell && fs.existsSync(userShell)) {
        return userShell;
    }

    for (const shell of ['/bin/zsh', '/bin/bash', '/bin/sh']) {
        if (fs.existsSync(shell)) {
            return shell;
        }
    }

    return '/bin/sh';
}

function getPythonBinary() {
    return process.platform === 'win32' ? 'python.exe' : 'python3'
}

function getFallbackCommand() {
    return process.platform === 'win32' ? 'py' : 'python3'
}

describe("detectShell", () => {
    it("returns a string", () => {
        expect(typeof detectShell()).toBe("string")
    })

    it("returns a valid shell path", () => {
        const shell = detectShell()
        expect(shell).toBeTruthy()
        expect(typeof shell).toBe("string")
    })

    it("does not return /bin/bash on macOS when zsh is default", () => {
        if (process.platform === 'darwin') {
            const shell = detectShell()
            expect(shell).not.toBe("/bin/bash")
        }
    })

    it("returns cmd.exe on Windows", () => {
        if (process.platform === 'win32') {
            expect(detectShell()).toBe("cmd.exe")
        }
    })
})

describe("getPythonBinary", () => {
    it("returns correct binary for current platform", () => {
        const binary = getPythonBinary()

        if (process.platform === 'win32') {
            expect(binary).toBe("python.exe")
        } else {
            expect(binary).toBe("python3")
        }
    })
})

describe("getFallbackCommand", () => {
    it("returns correct fallback for current platform", () => {
        const fallback = getFallbackCommand()

        if (process.platform === 'win32') {
            expect(fallback).toBe("py")
        } else {
            expect(fallback).toBe("python3")
        }
    })
})
