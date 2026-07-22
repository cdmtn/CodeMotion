import { ContextMenu } from "./handlers/contextMenuHandler.js"
import { normalizePath, parseTwemojiString, copyText } from "./lib.js"

let currentCodeContextMenu = null;
let currentEditor = null;

export function destroyCodeContextMenu() {
    if (currentCodeContextMenu) {
        if (currentEditor && currentCodeContextMenu._onNativeCtx) {
            currentEditor.off("nativecontextmenu", currentCodeContextMenu._onNativeCtx);
        }
        if (currentCodeContextMenu._onDocMouseDown) {
            document.removeEventListener("mousedown", currentCodeContextMenu._onDocMouseDown);
        }
        if (currentCodeContextMenu._onDocClick) {
            document.removeEventListener("mousedown", currentCodeContextMenu._onDocClick);
        }
        if (currentCodeContextMenu._onKey) {
            document.removeEventListener("keydown", currentCodeContextMenu._onKey);
        }
        if (currentCodeContextMenu.context && currentCodeContextMenu.context.parentNode) {
            currentCodeContextMenu.context.parentNode.removeChild(currentCodeContextMenu.context);
        }
        currentCodeContextMenu = null;
        currentEditor = null;
    }
}

export async function initCodeContextMenu(currentPath, pathContext, editor) {
    destroyCodeContextMenu();
    
    const uniqueMenuId = "codeContextMenu_" + Math.random().toString(36).substr(2, 9);
    const codeContextMenu = new ContextMenu(uniqueMenuId)
    currentCodeContextMenu = codeContextMenu;
    currentEditor = editor;

    codeContextMenu.bindOnEditor(editor, editor.dom)

    codeContextMenu.add({
        id: "cut", icon: "content_cut", content: "Cut line", shortcut: "Ctrl+X", func: () => {
            const selected = editor.getSelectedText();
            if (selected) {
                copyText(selected);
                editor.replace(editor.getSelectionRange(), "");
            } else {
                const row = editor.getCursorPosition().row;
                copyText(editor.getLineText(row));
                editor.removeFullLines(row, row);
            }
        }
    })
    codeContextMenu.add({
        id: "copy", icon: "content_copy", content: "Copy line", shortcut: "Ctrl+C", func: () => {
            const selected = editor.getSelectedText();
            if (selected) {
                copyText(selected);
            } else {
                copyText(editor.getLineText(editor.getCursorPosition().row));
            }
        }
    })
    codeContextMenu.add({
        id: "paste", icon: "content_paste", content: "Paste", shortcut: "Ctrl+V", func: async () => {
            await editor.pasteBufferContent();
        }
    })
    codeContextMenu.add({ type: "divider" })

    codeContextMenu.add({
        id: "selectAll", icon: "select_all", content: "Select All", shortcut: "Ctrl+A", func: () => {
            editor.selectAll();
        }
    })
    codeContextMenu.add({
        id: "duplicateLine", icon: "content_copy", content: "Duplicate Selection", shortcut: "Ctrl+Shift+D", func: () => {
            editor.duplicateSelection();
        }
    })
    codeContextMenu.add({
        id: "deleteLine", icon: "delete", content: "Delete Line", shortcut: "Ctrl+D", func: () => {
            editor.removeCurrentLine();
        }
    })
    codeContextMenu.add({ type: "divider" })

    codeContextMenu.add({
        id: "undo", icon: "undo", content: "Undo", shortcut: "Ctrl+Z", func: () => {
            editor.undo();
        }
    })
    codeContextMenu.add({
        id: "redo", icon: "redo", content: "Redo", shortcut: "Ctrl+Shift+Z", func: () => {
            editor.redo();
        }
    })
    codeContextMenu.add({ type: "divider" })

    codeContextMenu.add({
        id: "find", icon: "search", content: "Find", shortcut: "Ctrl+F", func: () => {
            editor.openSearch();
        }
    })
    // codeContextMenu.add({
    //     id: "goToLine", icon: "tag", content: "Go to Line...", shortcut: "Ctrl+G", func: () => {
    //         editor.commands.byName.gotoLine.exec(editor);
    //     }
    // })
    codeContextMenu.add({ type: "divider" })

    codeContextMenu.add({
        id: "toggleComment", icon: "code", content: "Toggle Comment", shortcut: "Ctrl+/", func: () => {
            editor.toggleCommentLine();
        }
    })
}