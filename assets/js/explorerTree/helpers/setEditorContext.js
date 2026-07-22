import { JavascriptParser } from "../../contextParsers/javascriptParser.js"
import { TypescriptParser } from "../../contextParsers/typescriptParser.js"
import { JSONParser } from "../../contextParsers/jsonParser.js"
import { HTMLParser } from "../../contextParsers/htmlParser.js"
import { CSSParser } from "../../contextParsers/cssParser.js"

import { addRuntimeError, GLS } from "../../lib.js"
import { GoParser } from "../../contextParsers/goParser.js"

let diagnosticTimer = null
let generation = 0

const SEVERITY_MAP = {
    Warning: "warning",
    Suggestion: "info",
    Error: "error",
}

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

function showDiagnostics(diagnostics, { editor, path }) {
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

    editor.setDiagnostics(list)

    diagnostics.forEach(item => {
        addRuntimeError({
            msg: item.message,
            line: Math.max(1, Number(item.line) || 1),
            col: Math.max(0, Number(item.col) || 0),
            time: Math.floor(Date.now() / 1000),
        })
    })
}

function clamp(value, max, min = 0) {
    return Math.min(Math.max(value, min), max)
}

export async function setEditorContext(properties = {}, { editor, language, updateEditorData, path, settings }) {
    const gls = GLS.initLocal()
    const isErrorsUpdate = properties.errorsUpdate !== false

    clearTimeout(diagnosticTimer)
    const currentGen = ++generation

    const setScriptContext = async (isTypeScript) => {
        const oxcLanguage = getOxcLanguage(path, isTypeScript ? "ts" : "js")
        const getDiagnostics = isTypeScript
            ? window.electron.typescriptDiagnostic
            : window.electron.javascriptDiagnostic
        const getAst = isTypeScript
            ? window.electron.typescriptAST
            : window.electron.javascriptAST
        const parser = isTypeScript ? new TypescriptParser() : new JavascriptParser()

        diagnosticTimer = setTimeout(async () => {
            const diagnostics = await getDiagnostics(editor.getValue(), oxcLanguage)

            if (currentGen !== generation || !isErrorsUpdate) return
            showDiagnostics(diagnostics, { editor, path })
        }, 500)

        const ast = await getAst(editor.getValue(), oxcLanguage)
        if (currentGen !== generation) return

        const row = editor.getCursorPosition().row + 1
        parser.renderContext(parser.getContextChain(ast, row))
    }

    const contextMap = {
        javascript: () => setScriptContext(false),
        jsx: () => setScriptContext(false),
        typescript: () => setScriptContext(true),
        json: () => {
            const jsonParser = new JSONParser()
            jsonParser.showJSONContext(editor, document.querySelector(".code-structure"))
        },
        html: () => {
            const htmlParser = new HTMLParser()
            htmlParser.showHTMLContext(editor, document.querySelector(".code-structure"))
        },
        css: () => {
            const cssParser = new CSSParser()
            const row = editor.getCursorPosition().row + 1

            const chain = cssParser.getContextChain(editor.getValue(), row)
            cssParser.renderContext(chain)
        },
        golang: async () => {
            const goParser = new GoParser()
            const ast = await window.electron.golangAST(editor.getValue())
            const row = editor.getCursorPosition().row + 1

            const chain = goParser.getContextChain(ast, row)
            goParser.renderContext(chain)
        }
    }

    if ("editor" in settings) {
        if ("goContextParser" in settings.editor && settings.editor.goContextParser == false) {
            delete contextMap["golang"]
        }
    }

    updateEditorData()

    if (language.mode in contextMap) {
        contextMap[language.mode]()
    }
    else {
        const codeStructure = document.querySelector(".code-structure")
        if (codeStructure) {
            codeStructure.textContent = gls.get("editor.nocontextFor", { name: language.name })
        }
    }
}