import { describe, it, expect } from "vitest"

function toBase64(str) {
    return Buffer.from(unescape(encodeURIComponent(str))).toString("base64")
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
}

function getCodeByName(name, raw = false) {
    const ext = (name || "").toLowerCase();

    const names = {
        html: "html",
        js: "javascript",
        css: "css",
        json: "json",
        md: "markdown",
        todo: "markdown",
        ps: "prettyscript",
        py: "python",
        php: "php"
    };
    const rawNames = {
        html: "html",
        js: "javascript",
        ps: "prettyscript",
        py: "python",
        md: "markdown",
        css: "css",
        php: "php"
    };

    if (!raw) return names[ext] || "plaintext";
    return rawNames[ext] || "text";
}

function capitilize(text) {
    return String(text).charAt(0).toUpperCase() + String(text).slice(1)
}

function formatUnix(ts, format = "{dd}.{mm}.{yyyy}, {hh}:{ii}:{ss}") {
    const date = new Date(ts * 1000);

    const yyyy = String(date.getFullYear());
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");

    const hh = String(date.getHours()).padStart(2, "0");
    const ii = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");

    if (format) {
        return format
            .replaceAll("{dd}", dd)
            .replaceAll("{mm}", mm)
            .replaceAll("{hh}", hh)
            .replaceAll("{ii}", ii)
            .replaceAll("{ss}", ss)
            .replaceAll("{yyyy}", yyyy)
    }
    else {
        return `${dd}.${mm}, ${hh}:${ii}:${ss}`;
    }
}

function getInitials(name) {
    if (!name) return 'A';
    const words = name.trim().split(/\s+/);
    return words.slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function isFloat(n) {
    return typeof n === 'number' && !Number.isInteger(n);
}

function isStringifiedObject(str) {
    try {
        const parsed = JSON.parse(str);

        if (Array.isArray(parsed)) return "array"
        if (typeof parsed === 'object' && parsed !== null) {
            return "object"
        }
        return null
    } catch (e) {
        return false;
    }
}

function truncateString(str, maxLength) {
    if (str.length <= maxLength) {
        return str;
    }

    return str.slice(0, maxLength) + '...';
}

function idify(string) {
    const bytes = new TextEncoder().encode(string);
    let binary = "";

    bytes.forEach(b => binary += String.fromCharCode(b));

    return Buffer.from(binary, "binary").toString("base64").replaceAll("=", "");
}

function splitCamelCase(str) {
    return str
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .split(" ")
        .map((w, i) => i === 0
            ? w.charAt(0).toUpperCase() + w.slice(1)
            : w.toLowerCase()
        )
}

function normalizePath(path) {
    return path
        .replaceAll("\\", "/")
        .replaceAll(/\\/g, "/")
}

function secondsToMinutes(seconds) {
    return seconds / 60;
}

function transparentColor(color, alpha = 1) {
    alpha = Math.max(0, Math.min(1, alpha));
    color = color.trim();

    if (color.startsWith('#')) {
        let hex = color.slice(1);

        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }

        if (hex.length !== 6) {
            throw new Error('Invalid HEX color');
        }

        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    const match = color.match(
        /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/i
    );

    if (match) {
        const [, r, g, b] = match;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    throw new Error('Unsupported color format');
}

function dedent(str) {
    const lines = str.replace(/^\n/, "").split("\n");

    const indent = Math.min(
        ...lines
            .filter(line => line.trim())
            .map(line => line.match(/^ */)[0].length)
    );

    return lines
        .map(line => line.slice(indent))
        .join("\n")
        .trimEnd();
}

function type(value) {
    const str = value.toString().trim()

    if (/^-?\d+$/.test(str)) return "int"
    if (/^-?\d*\.\d+$/.test(str)) return "float"
    if (/^(true|false)$/.test(str)) return "boolean"
    if (/^\[.*\]$/.test(str)) return "array"
    if (/^\{.*\}$/.test(str)) return "object"

    return "string"
}

function isObject(item) {
    return typeof item == "object" && !Array.isArray(item)
}

function isArray(item) {
    return typeof item == "object" && Array.isArray(item)
}

describe("toBase64", () => {
    it("encodes ascii strings", () => {
        expect(toBase64("hello")).toBe("aGVsbG8=")
    })

    it("encodes unicode strings", () => {
        expect(toBase64("привет")).toBeTruthy()
    })
})

describe("escapeHtml", () => {
    it("escapes HTML entities", () => {
        expect(escapeHtml("<div>")).toBe("&lt;div&gt;")
    })

    it("escapes ampersand", () => {
        expect(escapeHtml("a & b")).toBe("a &amp; b")
    })

    it("escapes quotes", () => {
        expect(escapeHtml('"hello\'')).toBe("&quot;hello&#039;")
    })

    it("converts non-strings", () => {
        expect(escapeHtml(123)).toBe("123")
        expect(escapeHtml(null)).toBe("null")
    })
})

describe("getCodeByName", () => {
    it("returns correct language names", () => {
        expect(getCodeByName("js")).toBe("javascript")
        expect(getCodeByName("py")).toBe("python")
        expect(getCodeByName("html")).toBe("html")
        expect(getCodeByName("css")).toBe("css")
        expect(getCodeByName("json")).toBe("json")
        expect(getCodeByName("md")).toBe("markdown")
    })

    it("returns plaintext for unknown extensions", () => {
        expect(getCodeByName("xyz")).toBe("plaintext")
        expect(getCodeByName("")).toBe("plaintext")
    })

    it("returns raw mode names", () => {
        expect(getCodeByName("js", true)).toBe("javascript")
        expect(getCodeByName("ps", true)).toBe("prettyscript")
    })
})

describe("capitilize", () => {
    it("capitalizes first letter", () => {
        expect(capitilize("hello")).toBe("Hello")
    })

    it("handles single character", () => {
        expect(capitilize("a")).toBe("A")
    })

    it("handles empty string", () => {
        expect(capitilize("")).toBe("")
    })

    it("converts non-strings", () => {
        expect(capitilize(123)).toBe("123")
    })
})

describe("formatUnix", () => {
    it("formats timestamp to default format", () => {
        const ts = 1700000000
        const result = formatUnix(ts)
        expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2}/)
    })

    it("formats with custom format string", () => {
        const ts = 1700000000
        const result = formatUnix(ts, "{dd}/{mm}/{yyyy}")
        expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    })

    it("handles zero format (falsy)", () => {
        const ts = 1700000000
        const result = formatUnix(ts, 0)
        expect(result).toMatch(/\d{2}\.\d{2}, \d{2}:\d{2}:\d{2}/)
    })
})

describe("getInitials", () => {
    it("returns first letters of first two words", () => {
        expect(getInitials("John Doe")).toBe("JD")
    })

    it("returns single initial for one word", () => {
        expect(getInitials("Alice")).toBe("A")
    })

    it("returns A for empty input", () => {
        expect(getInitials("")).toBe("A")
        expect(getInitials(null)).toBe("A")
    })

    it("caps extra words to max 2", () => {
        expect(getInitials("John Michael Doe")).toBe("JM")
    })
})

describe("isFloat", () => {
    it("returns true for floats", () => {
        expect(isFloat(3.14)).toBe(true)
        expect(isFloat(-0.5)).toBe(true)
    })

    it("returns false for integers", () => {
        expect(isFloat(42)).toBe(false)
        expect(isFloat(0)).toBe(false)
    })

    it("returns false for non-numbers", () => {
        expect(isFloat("3.14")).toBe(false)
    })
})

describe("isStringifiedObject", () => {
    it("returns object for JSON objects", () => {
        expect(isStringifiedObject('{"a":1}')).toBe("object")
    })

    it("returns array for JSON arrays", () => {
        expect(isStringifiedObject('[1,2,3]')).toBe("array")
    })

    it("returns false for invalid JSON", () => {
        expect(isStringifiedObject("not json")).toBe(false)
    })

    it("returns null for JSON primitives", () => {
        expect(isStringifiedObject('"hello"')).toBe(null)
        expect(isStringifiedObject("42")).toBe(null)
    })
})

describe("truncateString", () => {
    it("returns original string if within limit", () => {
        expect(truncateString("hello", 10)).toBe("hello")
    })

    it("truncates and adds ellipsis", () => {
        expect(truncateString("hello world", 5)).toBe("hello...")
    })

    it("handles exact length", () => {
        expect(truncateString("hello", 5)).toBe("hello")
    })
})

describe("idify", () => {
    it("returns base64 encoded string", () => {
        const result = idify("hello")
        expect(result).toBeTruthy()
        expect(result).not.toContain("=")
    })

    it("produces unique ids", () => {
        expect(idify("hello")).not.toBe(idify("world"))
    })
})

describe("splitCamelCase", () => {
    it("splits camelCase", () => {
        expect(splitCamelCase("camelCase")).toEqual(["Camel", "case"])
    })

    it("splits PascalCase", () => {
        expect(splitCamelCase("PascalCase")).toEqual(["Pascal", "case"])
    })

    it("handles single word", () => {
        expect(splitCamelCase("hello")).toEqual(["Hello"])
    })
})

describe("normalizePath", () => {
    it("replaces backslashes with forward slashes", () => {
        expect(normalizePath("C:\\Users\\test")).toBe("C:/Users/test")
    })

    it("leaves forward slashes unchanged", () => {
        expect(normalizePath("/usr/local")).toBe("/usr/local")
    })
})

describe("secondsToMinutes", () => {
    it("converts seconds to minutes", () => {
        expect(secondsToMinutes(60)).toBe(1)
        expect(secondsToMinutes(120)).toBe(2)
    })

    it("returns decimal for partial minutes", () => {
        expect(secondsToMinutes(90)).toBe(1.5)
    })
})

describe("transparentColor", () => {
    it("converts hex to rgba", () => {
        expect(transparentColor("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)")
    })

    it("converts 3-digit hex", () => {
        expect(transparentColor("#fff")).toBe("rgba(255, 255, 255, 1)")
    })

    it("converts rgb to rgba", () => {
        expect(transparentColor("rgb(10, 20, 30)", 0.8)).toBe("rgba(10, 20, 30, 0.8)")
    })

    it("clamps alpha to 0-1", () => {
        expect(transparentColor("#000", 2)).toContain("1)")
        expect(transparentColor("#000", -1)).toContain("0)")
    })

    it("throws on invalid format", () => {
        expect(() => transparentColor("notacolor")).toThrow("Unsupported color format")
    })
})

describe("dedent", () => {
    it("removes common indentation", () => {
        const input = "\n    hello\n    world\n"
        expect(dedent(input)).toBe("hello\nworld")
    })

    it("handles no indentation", () => {
        expect(dedent("\nhello\nworld\n")).toBe("hello\nworld")
    })
})

describe("type (renderer)", () => {
    it("identifies ints", () => {
        expect(type(42)).toBe("int")
        expect(type("42")).toBe("int")
    })

    it("identifies floats", () => {
        expect(type(3.14)).toBe("float")
        expect(type("3.14")).toBe("float")
    })

    it("identifies booleans", () => {
        expect(type(true)).toBe("boolean")
        expect(type("true")).toBe("boolean")
    })

    it("identifies arrays", () => {
        expect(type("[1,2,3]")).toBe("array")
    })

    it("identifies objects", () => {
        expect(type('{"a":1}')).toBe("object")
    })

    it("defaults to string", () => {
        expect(type("hello")).toBe("string")
    })
})

describe("isObject / isArray", () => {
    it("isObject returns true for plain objects", () => {
        expect(isObject({})).toBe(true)
        expect(isObject(null)).toBe(true)
        expect(isObject([])).toBe(false)
    })

    it("isArray returns true for arrays", () => {
        expect(isArray([])).toBe(true)
        expect(isArray({})).toBe(false)
    })
})
