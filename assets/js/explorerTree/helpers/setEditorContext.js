import { JavascriptParser } from "../../contextParsers/javascriptParser.js"
import { TypescriptParser } from "../../contextParsers/typescriptParser.js"
import { JSONParser } from "../../contextParsers/jsonParser.js"
import { HTMLParser } from "../../contextParsers/htmlParser.js"
import { CSSParser } from "../../contextParsers/cssParser.js"

import { addRuntimeError } from "../../lib.js"
import { GoParser } from "../../contextParsers/goParser.js"

const errors = new Map()
const markerIds = new Set()
const aceRange = ace.require("ace/range").Range

let diagnosticTimer = null
let generation = 0
let renderToken = 0

function addMarker(key, range) {
    if (markerIds.has(key)) return
    const id = editor.session.addMarker(range, "error-marker", "fullLine")
    markerIds.set(key, id)
}

function clearMarkers() {
    for (const id of markerIds) {
        editor.session.removeMarker(id)
    }
    markerIds.clear()

    editor.renderer.updateFull()
}

function makeErrorKey(item, path) {
    return `${item.line}:${path}`
}

function renderErrors({ editor }) {
    const token = ++renderToken

    for (const id of markerIds) {
        editor.session.removeMarker(id)
    }
    markerIds.clear()

    const annotations = []

    for (const err of errors.values()) {
        if (token !== renderToken) return

        err.markerId = null
        annotations.push(err.annotation)

        const id = editor.session.addMarker(
            err.range,
            "error-marker",
            "fullLine"
        )

        markerIds.add(id)
        err.markerId = id
    }

    editor.session.setAnnotations(annotations)
    editor.renderer.updateFull()
}

function clearErrors({ editor }) {
    const allMarkers = editor.session.getMarkers()
    for (const id in allMarkers) {
        if (allMarkers[id].clazz === "error-marker") {
            editor.session.removeMarker(Number(id))
        }
    }
    markerIds.clear()
    errors.clear()
    editor.session.setAnnotations([])
    editor.renderer.updateFull()
}

export async function setEditorContext(properties = {}, { editor, language, updateEditorData, path }) {
    const isErrorsUpdate = properties.errorsUpdate !== false

    updateEditorData()

    clearTimeout(diagnosticTimer)
    const currentGen = ++generation

    if (language.mode === "javascript") {
        editor.getSession().setUseWorker(false)

        diagnosticTimer = setTimeout(async () => {
            const diagnostics = await window.electron.javascriptDiagnostic(editor.getValue())

            if (currentGen !== generation) return
            if (!isErrorsUpdate) return

            clearErrors({
                editor: editor
            })

            diagnostics.forEach(item => {
                const range = new aceRange(
                    item.line - 1,
                    item.col,
                    item.line - 1,
                    999
                )

                errors.set(makeErrorKey(item, path), {
                    range,
                    annotation: {
                        row: item.line - 1,
                        column: item.col,
                        text: item.message,
                        type: "error"
                    },
                    markerId: null
                })

                addRuntimeError({
                    msg: item.message,
                    line: item.line,
                    col: item.col,
                    time: Math.floor(Date.now() / 1000)
                })
            })

            renderErrors({ editor: editor })
        }, 500)

        const jsParser = new JavascriptParser()
        const ast = await window.electron.javascriptAST(editor.getValue())
        const row = editor.getCursorPosition().row + 1

        const chain = jsParser.getContextChain(ast, row)
        jsParser.renderContext(chain)
    }

    else if (language.mode === "typescript") {
        editor.getSession().setUseWorker(false)

        diagnosticTimer = setTimeout(async () => {
            const diagnostics = await window.electron.typescriptDiagnostic(editor.getValue())

            if (currentGen !== generation) return
            if (!isErrorsUpdate) return

            clearErrors({
                editor: editor
            })

            diagnostics.forEach(item => {
                const range = new aceRange(
                    item.line - 1,
                    item.col,
                    item.line - 1,
                    999
                )

                errors.set(makeErrorKey(item, path), {
                    range,
                    annotation: {
                        row: item.line - 1,
                        column: item.col,
                        text: item.message,
                        type: "error"
                    },
                    markerId: null
                })

                addRuntimeError({
                    msg: item.message,
                    line: item.line,
                    col: item.col,
                    time: Math.floor(Date.now() / 1000)
                })
            })

            renderErrors({ editor: editor })
        }, 500)

        const tsParser = new TypescriptParser()
        const ast = await window.electron.typescriptAST(editor.getValue())
        const row = editor.getCursorPosition().row + 1

        const chain = tsParser.getContextChain(ast, row)
        tsParser.renderContext(chain)
    }

    else if (language.mode === "json") {
        const jsonParser = new JSONParser()
        jsonParser.showJSONContext(editor, document.querySelector(".code-structure"))
    }

    else if (language.mode === "html") {
        const htmlParser = new HTMLParser()
        htmlParser.showHTMLContext(editor, document.querySelector(".code-structure"))
    }

    else if (language.mode === "css") {
        const cssParser = new CSSParser()
        const row = editor.getCursorPosition().row + 1

        const chain = cssParser.getContextChain(editor.getValue(), row)
        cssParser.renderContext(chain)
    }

    else if (language.mode === "golang") {
        const goParser = new GoParser()
        const ast = await window.electron.golangAST(editor.getValue())
        const row = editor.getCursorPosition().row + 1

        const chain = goParser.getContextChain(ast, row)
        goParser.renderContext(chain)
    }

    else {
        editor.getSession().setUseWorker(true)

        const codeStructure = document.querySelector(".code-structure")
        if (codeStructure) {
            codeStructure.textContent = `Context unavailable for ${language.name}`
        }
    }

    console.log(language.mode)
}