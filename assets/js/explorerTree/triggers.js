import { sendEvent } from "../bus.js"

function getTriggerObj({ editor, language, extension }) {
    return {
        editorId: editor.id,
        editorValue: editor.getValue(),
        editorMode: editor.session.$modeId,
        editorLanguage: language.mode,
        editorLanguageExtension: extension,
        errors: editor.getSession().getAnnotations().filter(item => item.type === "error").length,
        cursor: {
            line: editor.getCursorPosition().row + 1,
            column: editor.getCursorPosition().column + 1
        }
    }
}

export function triggerAceChanged({ editor, extension, language }) {
    window.electron.triggers.sendAceChanged(
        getTriggerObj({ editor: editor, extension: extension, language: language })
    )

    sendEvent("ace-mode-changed", { extension: extension, editor: editor, mode: editor.session.$modeId })
}
export function triggerAceClicked({ editor, extension, language }) {
    window.electron.triggers.sendAceClicked(
        getTriggerObj({ editor: editor, extension: extension, language: language })
    )

    sendEvent("ace-mode-clicked", { extension: extension, editor: editor, mode: editor.session.$modeId })
}