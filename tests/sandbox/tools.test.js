import { describe, it, expect } from "vitest"
import {
    getType,
    checkType,
    ok,
    fail,
    isSafeName,
    stringify,
    getArgumentNames,
    getExt,
} from "../../app/sandbox/tools.js"

describe("getType", () => {
    it("returns int for integer numbers", () => {
        expect(getType(0)).toBe("int")
        expect(getType(42)).toBe("int")
        expect(getType(-100)).toBe("int")
    })

    it("returns float for decimal numbers", () => {
        expect(getType(3.14)).toBe("float")
        expect(getType(-0.5)).toBe("float")
    })

    it("returns string for strings", () => {
        expect(getType("hello")).toBe("string")
        expect(getType("")).toBe("string")
    })

    it("returns CSSFile for .css extensions", () => {
        expect(getType("style.css")).toBe("CSSFile")
    })

    it("returns JSFile for .js extensions", () => {
        expect(getType("index.js")).toBe("JSFile")
    })

    it("returns SVGFile for .svg extensions", () => {
        expect(getType("icon.svg")).toBe("SVGFile")
    })

    it("returns PNGFile for .png extensions", () => {
        expect(getType("image.png")).toBe("PNGFile")
    })

    it("returns HEX for hex color strings", () => {
        expect(getType("#fff")).toBe("HEX")
        expect(getType("#FF00AA")).toBe("HEX")
        expect(getType("#12345678")).toBe("HEX")
    })

    it("returns RGB for rgb/rgba strings", () => {
        expect(getType("rgb(255, 0, 0)")).toBe("RGB")
        expect(getType("rgba(0, 255, 0, 0.5)")).toBe("RGB")
    })

    it("returns null for null", () => {
        expect(getType(null)).toBe("null")
    })

    it("returns array for arrays", () => {
        expect(getType([])).toBe("array")
        expect(getType([1, 2, 3])).toBe("array")
    })

    it("returns function for functions", () => {
        expect(getType(() => {})).toBe("function")
    })

    it("returns object for objects", () => {
        expect(getType({})).toBe("object")
        expect(getType({ a: 1 })).toBe("object")
    })

    it("returns any for undefined and other types", () => {
        expect(getType(undefined)).toBe("any")
        expect(getType(NaN)).toBe("any")
        expect(getType(Infinity)).toBe("any")
    })
})

describe("checkType", () => {
    it("returns true when value matches single type", () => {
        expect(checkType("int", 42)).toBe(true)
        expect(checkType("string", "hello")).toBe(true)
    })

    it("returns false when value does not match", () => {
        expect(checkType("int", "hello")).toBe(false)
        expect(checkType("string", 42)).toBe(false)
    })

    it("supports union types with |", () => {
        expect(checkType("int|float", 42)).toBe(true)
        expect(checkType("int|float", 3.14)).toBe(true)
        expect(checkType("int|float", "hello")).toBe(false)
    })

    it("trims whitespace in type union", () => {
        expect(checkType("int | float", 42)).toBe(true)
    })
})

describe("ok", () => {
    it("returns success result object", () => {
        expect(ok("data")).toEqual({ success: true, result: "data" })
    })

    it("works with objects", () => {
        expect(ok({ a: 1 })).toEqual({ success: true, result: { a: 1 } })
    })
})

describe("fail", () => {
    it("returns failure result from Error", () => {
        const result = fail(new Error("something broke"))
        expect(result).toEqual({ success: false, result: "something broke" })
    })

    it("returns failure result from string", () => {
        expect(fail("oops")).toEqual({ success: false, result: "oops" })
    })
})

describe("isSafeName", () => {
    it("returns true for safe names", () => {
        expect(isSafeName("my-extension")).toBe(true)
        expect(isSafeName("ext123")).toBe(true)
        expect(isSafeName("a")).toBe(true)
    })

    it("returns false for path traversal", () => {
        expect(isSafeName("..")).toBe(false)
        expect(isSafeName("../etc/passwd")).toBe(false)
        expect(isSafeName("foo/../../bar")).toBe(false)
    })

    it("returns false for absolute paths", () => {
        expect(isSafeName("/etc/passwd")).toBe(false)
    })

    it("returns false for non-strings", () => {
        expect(isSafeName(123)).toBe(false)
        expect(isSafeName(null)).toBe(false)
        expect(isSafeName(undefined)).toBe(false)
    })
})

describe("stringify", () => {
    it("stringifies primitives", () => {
        expect(stringify(42)).toBe("42")
        expect(stringify("hello")).toBe("hello")
        expect(stringify(true)).toBe("true")
    })

    it("stringifies objects as JSON", () => {
        expect(stringify({ a: 1 })).toBe('{"a":1}')
    })

    it("stringifies functions with name", () => {
        function myFunc(a, b) {}
        const result = stringify(myFunc)
        expect(result).toContain("function myFunc")
        expect(result).toContain("a")
        expect(result).toContain("b")
    })

    it("stringifies anonymous functions", () => {
        const result = stringify(() => {})
        expect(result).toContain("function")
    })
})

describe("getArgumentNames", () => {
    it("extracts argument names", () => {
        function test(a, b, c) {}
        expect(getArgumentNames(test)).toEqual(["a", "b", "c"])
    })

    it("returns empty array for no arguments", () => {
        function test() {}
        expect(getArgumentNames(test)).toEqual([])
    })

    it("handles single argument", () => {
        function test(x) {}
        expect(getArgumentNames(test)).toEqual(["x"])
    })
})

describe("getExt", () => {
    it("returns file extension", () => {
        expect(getExt("file.js")).toBe(".js")
        expect(getExt("style.css")).toBe(".css")
        expect(getExt("image.png")).toBe(".png")
    })

    it("returns empty string for no extension", () => {
        expect(getExt("Makefile")).toBe("")
    })
})
