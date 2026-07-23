import { describe, it, expect } from "vitest"

function escapePS(filePath) {
    return filePath.replace(/'/g, "''")
}

function escapeOSA(filePath) {
    return filePath.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/`/g, "\\`")
}

function escapeURL(filePath) {
    return "file://" + filePath.replace(/\\/g, "/").replace(/[^a-zA-Z0-9-._~:/?#\[\]@!'()*+,;=%]/g, encodeURIComponent)
}

describe("debugger copy-as-file escaping", () => {
    const normalPath = "/tmp/Debugger-cdmtn-20260723_143022.txt"

    describe("PowerShell escaping", () => {
        it("handles normal path", () => {
            expect(escapePS(normalPath)).toBe(normalPath)
        })

        it("escapes single quotes", () => {
            expect(escapePS("/tmp/test'file.txt")).toBe("/tmp/test''file.txt")
        })

        it("escapes multiple single quotes", () => {
            expect(escapePS("it's a 'file'.txt")).toBe("it''s a ''file''.txt")
        })

        it("leaves double quotes alone", () => {
            expect(escapePS('/tmp/test"file.txt')).toBe('/tmp/test"file.txt')
        })
    })

    describe("osascript escaping", () => {
        it("handles normal path", () => {
            expect(escapeOSA(normalPath)).toBe(normalPath)
        })

        it("escapes double quotes", () => {
            expect(escapeOSA('/tmp/test"file.txt')).toBe('/tmp/test\\"file.txt')
        })

        it("escapes backslashes", () => {
            expect(escapeOSA("C:\\Users\\test\\file.txt")).toBe("C:\\\\Users\\\\test\\\\file.txt")
        })

        it("escapes both backslashes and double quotes", () => {
            expect(escapeOSA('C:\\Users\\test"file.txt')).toBe('C:\\\\Users\\\\test\\"file.txt')
        })

        it("blocks $(cmd) injection", () => {
            const injected = '/tmp/$(rm -rf /)/file.txt'
            const escaped = escapeOSA(injected)
            expect(escaped).toContain("\\$(")
        })

        it("blocks backtick injection", () => {
            const injected = '/tmp/`whoami`/file.txt'
            const escaped = escapeOSA(injected)
            expect(escaped).toContain("\\`whoami\\`")
        })
    })

    describe("URL escaping", () => {
        it("handles normal path", () => {
            expect(escapeURL(normalPath)).toBe("file://" + normalPath)
        })

        it("encodes spaces", () => {
            expect(escapeURL("/tmp/my file.txt")).toBe("file:///tmp/my%20file.txt")
        })

        it("encodes special characters", () => {
            expect(escapeURL("/tmp/test&file.txt")).toBe("file:///tmp/test%26file.txt")
        })

        it("encodes shell metacharacters", () => {
            const injected = "/tmp/$(rm -rf /)/file.txt"
            const escaped = escapeURL(injected)
            expect(escaped).toContain("%24(")
        })

        it("encodes backticks", () => {
            const escaped = escapeURL("/tmp/`whoami`/file.txt")
            expect(escaped).not.toContain("`")
            expect(escaped).toContain("%60")
        })

        it("converts Windows backslashes to forward slashes", () => {
            expect(escapeURL("C:\\Users\\test\\file.txt")).toBe("file://C:/Users/test/file.txt")
        })
    })
})
