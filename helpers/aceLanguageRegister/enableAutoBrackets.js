export let autoBracketPatched = false

export function enableAutoBrackets(languageId, editor) {
    if (autoBracketPatched) return
    autoBracketPatched = true

    const Editor = ace.require("ace/editor").Editor

    const pairs = {
        "(": ")",
        "{": "}",
        "[": "]",
        "\"": "\"",
        "'": "'"
    }

    const blockPairs = {
        "{": true,
        "(": true
    }

    const originalInsert = Editor.prototype.insert
    Editor.prototype.insert = function(text) {
        const mode = this.session.$mode?.$id

        if (mode === `ace/mode/${languageId}`) {
            if (pairs[text]) {
                const closing = pairs[text]
                originalInsert.call(this, text + closing)
                this.navigateLeft(1)
                return
            }
        }

        return originalInsert.call(this, text)
    }

    const originalRemove = Editor.prototype.remove
    Editor.prototype.remove = function(direction) {
        const mode = this.session.$mode?.$id

        if (mode === `ace/mode/${languageId}` && direction === "left") {
            const cursor = this.getCursorPosition()
            const line = this.session.getLine(cursor.row)

            const charBefore = line[cursor.column - 1]
            const charAfter = line[cursor.column]

            if (pairs[charBefore] && pairs[charBefore] === charAfter) {
                this.session.doc.remove({
                    start: { row: cursor.row, column: cursor.column - 1 },
                    end: { row: cursor.row, column: cursor.column + 1 }
                })
                return
            }
        }

        return originalRemove.call(this, direction)
    }

    editor.commands.addCommand({
        name: "autoBracketNewline",
        bindKey: { win: "Enter", mac: "Enter" },
        exec: function(ed) {
            const mode = ed.session.$mode?.$id

            if (mode === `ace/mode/${languageId}`) {
                const cursor = ed.getCursorPosition()
                const line = ed.session.getLine(cursor.row)

                const charBefore = line[cursor.column - 1]
                const charAfter = line[cursor.column]

                if (blockPairs[charBefore] && pairs[charBefore] === charAfter) {
                    const indent = ed.session.getTabString()
                    const currentIndent = line.match(/^\s*/)[0]

                    ed.session.doc.insert(
                        { row: cursor.row, column: cursor.column },
                        "\n" + currentIndent + indent + "\n" + currentIndent
                    )

                    ed.navigateUp(1)
                    ed.navigateLineEnd()
                    return
                }
            }

            ed.insert("\n")
        }
    })
}