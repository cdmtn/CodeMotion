import { JavascriptParser } from "../../contextParsers/javascriptParser.js"
import { TypescriptParser } from "../../contextParsers/typescriptParser.js"
import { JSONParser } from "../../contextParsers/jsonParser.js"
import { HTMLParser } from "../../contextParsers/htmlParser.js"
import { CSSParser } from "../../contextParsers/cssParser.js"

import { setRuntimeErrors, GLS } from "../../lib.js"
import { GoParser } from "../../contextParsers/goParser.js"
import { YAMLParser } from "../../contextParsers/yamlParser.js"
import { PythonParser } from "../../contextParsers/pythonParser.js"

let diagnosticTimer = null
let typeCheckTimer = null
let unusedTimer = null
let generation = 0

const SEVERITY_MAP = {
    Warning: "warning",
    Suggestion: "info",
    Error: "error",
}

const SCRIPT_MODES = ["javascript", "jsx", "typescript"]
const DATA_MODES = ["json", "yaml"]

function getOxcLanguage(filePath, fallback) {
    const path = String(filePath || "").toLowerCase()
    if (path.endsWith(".d.ts")) return "dts"

    const extension = path.match(/\.([^.\\/]+)$/)?.[1]
    const languageByExtension = {
        js: "js",
        mjs: "js",
        cjs: "js",
        es6: "js",
        jsx: "jsx",
        ts: "ts",
        mts: "ts",
        cts: "ts",
        tsx: "tsx",
    }

    return languageByExtension[extension] || fallback
}

function resolveFilePath(path, oxcLanguage) {
    if (path) return path
    return `untitled.${oxcLanguage === "tsx" ? "tsx" : oxcLanguage}`
}

function showDiagnostics(diagnostics, { editor, path, source }) {
    const docLength = editor.getValue().length

    const list = diagnostics.map(item => {
        const from = clamp(item.from, docLength)
        const to = clamp(item.to, docLength, from)

        return {
            from,
            to,
            severity: SEVERITY_MAP[item.category] || "error",
            message: item.message,
        }
    })

    editor.setDiagnosticsFor(source, list)

    setRuntimeErrors({
        source,
        path,
        errors: diagnostics.map(item => ({
            msg: item.message,
            line: Math.max(1, Number(item.line) || 1),
            col: Math.max(0, Number(item.col) || 0),
            time: Math.floor(Date.now() / 1000),
        })),
    })
}

function clamp(value, max, min = 0) {
    return Math.min(Math.max(value, min), max)
}

export async function setEditorContext(properties = {}, { editor, language, updateEditorData, path, settings }) {
	const codeStructureEl = document.querySelector(".code-structure")

    const gls = GLS.initLocal()
    const isErrorsUpdate = properties.errorsUpdate !== false

    if (isErrorsUpdate) {
        clearTimeout(diagnosticTimer)
        clearTimeout(typeCheckTimer)
        clearTimeout(unusedTimer)
    }
    const currentGen = isErrorsUpdate ? ++generation : generation

    if (!SCRIPT_MODES.includes(language.mode)) {
        if (!DATA_MODES.includes(language.mode)) editor.setDiagnosticsFor("syntax", [])
        editor.setDiagnosticsFor("types", [])
        editor.setDiagnosticsFor("semantic", [])
    }

    const setDataDiagnostics = (getDiagnostics) => {
        if (!isErrorsUpdate) return
        diagnosticTimer = setTimeout(async () => {
            const diagnostics = await getDiagnostics(editor.getValue())
            if (currentGen !== generation) return
            showDiagnostics(diagnostics, { editor, path, source: "syntax" })
        }, 400)
    }

    const setScriptContext = async (isTypeScript) => {
        const oxcLanguage = getOxcLanguage(path, isTypeScript ? "ts" : "js")
        const filePath = resolveFilePath(path, oxcLanguage)
        const getDiagnostics = isTypeScript
            ? window.electron.typescriptDiagnostic
            : window.electron.javascriptDiagnostic
        const getAst = isTypeScript
            ? window.electron.typescriptAST
            : window.electron.javascriptAST
        const parser = isTypeScript ? new TypescriptParser() : new JavascriptParser()

        if (isErrorsUpdate) {
            diagnosticTimer = setTimeout(async () => {
                const diagnostics = await getDiagnostics(editor.getValue(), oxcLanguage)
                if (currentGen !== generation) return
                showDiagnostics(diagnostics, { editor, path, source: "syntax" })
            }, 500)

            typeCheckTimer = setTimeout(async () => {
                const code = editor.getValue()
                const typeDiagnostics = await window.electron.tsTypeCheck(code, filePath)

                if (currentGen !== generation) return
                showDiagnostics(typeDiagnostics, { editor, path, source: "types" })
            }, 400)

            unusedTimer = setTimeout(async () => {
                if (typeof window.electron.tsUnused !== "function") return
                try {
                    const ranges = await window.electron.tsUnused(editor.getValue(), filePath)
                    if (currentGen !== generation) return
                    editor.setUnusedRanges(ranges)
                } catch (_) {}
            }, 500)
        }

        const ast = await getAst(editor.getValue(), oxcLanguage)
        if (isErrorsUpdate && currentGen !== generation) return

        const row = editor.getCursorPosition().row + 1
        parser.renderContext(parser.getContextChain(ast, row))
    }

    const contextMap = {
        javascript: () => setScriptContext(false),
        jsx: () => setScriptContext(false),
        typescript: () => setScriptContext(true),
        json: () => {
            setDataDiagnostics(window.electron.jsonDiagnostic)

            const jsonParser = new JSONParser()
            jsonParser.showJSONContext(editor, codeStructureEl)
        },
        yaml: async () => {
            setDataDiagnostics(window.electron.yamlDiagnostic)

            const yamlParser = new YAMLParser()
            const ast = await window.electron.yamlAST(editor.getValue())
            const row = editor.getCursorPosition().row + 1

            yamlParser.renderContext(yamlParser.getContextChain(ast, row))
        },
        html: () => {
            const htmlParser = new HTMLParser()
            htmlParser.showHTMLContext(editor, codeStructureEl)
        },
        css: () => {
            const cssParser = new CSSParser()
            const row = editor.getCursorPosition().row + 1

            const chain = cssParser.getContextChain(editor.getValue(), row)
            cssParser.renderContext(chain)
        },
        go: async () => {
            const goParser = new GoParser()
            const ast = await window.electron.golangAST(editor.getValue())
            const row = editor.getCursorPosition().row + 1

            const chain = goParser.getContextChain(ast, row)
            goParser.renderContext(chain)
        },
        python: async () => {
            const pythonParser = new PythonParser()
            const ast = await window.electron.pythonAST(editor.getValue())
            const row = editor.getCursorPosition().row + 1

            const chain = pythonParser.getContextChain(ast, row)
            pythonParser.renderContext(chain)
        }
    }

    if ("editor" in settings) {
        if ("goContextParser" in settings.editor && settings.editor.goContextParser == false) {
            delete contextMap["go"]
        }
    }

    updateEditorData()

    if (language.mode in contextMap) {
		contextMap[language.mode]()
    }
    else {
        if (codeStructureEl) {
            codeStructureEl.textContent = gls.get("editor.nocontextFor", { name: language.name })
        }
	}
}
