const { net, nativeImage, app } = require("electron")
const fs = require("fs")
const path = require("path")

function log(...args) {
    console.log(...args)
}

async function createNativeImageFromUrl(imageUrl) {
    // Wait for the app to be ready before using net module
    await app.whenReady();

    const request = net.request(imageUrl);
    const chunks = [];

    return new Promise((resolve, reject) => {
        request.on('response', (response) => {
            response.on('data', (chunk) => {
                chunks.push(chunk);
            });

            response.on('end', () => {
                // Concatenate all chunks into a single buffer
                const imageBuffer = Buffer.concat(chunks);

                // Create the NativeImage instance from the buffer
                const image = nativeImage.createFromBuffer(imageBuffer);

                if (image.isEmpty()) {
                    reject(new Error('Failed to create NativeImage from buffer. The URL might not be a valid image.'));
                } else {
                    resolve(image);
                }
            });
        });

        request.on('error', (error) => {
            reject(error);
        });

        request.end();
    });
}
function getType(value) {
    if (typeof value === "number" && !isNaN(value) && isFinite(value)) {
        return value % 1 !== 0 ? "float" : "int";
    }
    if (typeof value === "string") {
        if (value.endsWith(".css")) return "CSSFile";
        if (value.endsWith(".js")) return "JSFile";
        if (value.endsWith(".svg")) return "SVGFile";
        if (value.endsWith(".png")) return "PNGFile";
        if (/^#([0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{6}|[0-9A-F]{8})$/i.test(value)) return "HEX"
        if (/^rgb[a]?\(\s*(?:\d{1,3}%?,\s*){2}\d{1,3}%?(?:,\s*(?:0?\.\d+|\d+|\d{1,3}%?))?\s*\)$/i.test(value)) return "RGB"

        return "string";
    }
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    if (typeof value === "function") return "function";
    if (typeof value === "object") return "object";

    return "any";
}
function checkType(type, value) {
    const allowedTypes = type.split("|").map(t => t.trim())
    const valueType = getType(value)

    return allowedTypes.includes(valueType)
}
function ok(result) {
    return { success: true, result }
}
function fail(error) {
    return { success: false, result: error instanceof Error ? error.message : String(error) }
}
function isSafeName(name) {
    return typeof name === "string" && !name.includes("..") && !path.isAbsolute(name)
}
function stringify(v) {
    try {
        if (typeof v === "object") {
            return JSON.stringify(v);
        }
        if (typeof v === "function") {
            let args = v.toString().match(/\(([\s\S]*?)\)/)[1].split(',').map(s => s.trim())
            return `&lt;${v.name ? `function ${v.name}` : "function"}:(${args})&gt;`
        }
        return String(v);
    } catch {
        return "[Unserializable]";
    }
}
function saveReadFile(path, throwError = false) {
    if (fs.existsSync(path)) {
        const data = fs.readFileSync(path, 'utf-8');
        return data;
    } else {
        if (throwError) {
            throw new Error(`The file at the path "${path}" was not found or is empty`)
        }
        return false;
    }
}
function isFileExists(path, throwError = false) {
    if (fs.existsSync(path)) {
        return true
    } else {
        if (throwError) {
            throw new Error(`The file at the path "${path}" was not found`)
        }
        return false;
    }
}
function checkFields(fieldsParentName = "", object = {}, fields = {}) {
    const keys = Object.keys(object)
    const fieldsKeys = Object.keys(fields)

    for (const field of fieldsKeys) {
        if (!keys.includes(field)) {
            throw new Error(
                `[${fieldsParentName}] Missing "${field}" field, expected "${fields[field]}"`
            )
        }

        if (!checkType(fields[field], object[field])) {
            throw new Error(
                `[${fieldsParentName}] Field "${field}" has type "${getType(object[field])}", expected "${fields[field].replaceAll("|", " or ")}"`
            )
        }
    }

}
function createSandboxConsole(extensionName, debuggerSender) {
    function send(type, args) {
        debuggerSender.send("debug-event", {
            data: {
                type: type,
                content: args.map(a => stringify(a)).join(", "),
                from: extensionName
            },
            time: Date.now()
        })
    }

    return {
        log: (...args) => {
            send("msg", args);
        },
        warn: (...args) => {
            send("warn", args);
        },
        error: (...args) => {
            send("error", args);
            throw new ExtensionError(args.join(", "))
        }
    };
}
function getArgumentNames(func) {
    let STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    let ARGUMENT_NAMES = /([^\s,]+)/g;

    function getParamNames(func) {
        var fnStr = func.toString().replace(STRIP_COMMENTS, '');
        var result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
        if (result === null)
            result = [];
        return result;
    }

    return getParamNames(func)
}

function getExt(filename) {
    const ext = path.extname(filename)
    return ext
}

class ExtensionError extends Error {
    constructor(err) {
        super(typeof err === "string" ? err : err?.message);
        this.name = "ExtensionError";
    }
}

module.exports = { 
    createNativeImageFromUrl, 
    getType, 
    checkType, 
    ok, 
    fail, 
    isSafeName,
    stringify,
    saveReadFile,
    isFileExists,
    checkFields,
    createSandboxConsole,
    getArgumentNames,
    log,
    getExt,

    ExtensionError
}