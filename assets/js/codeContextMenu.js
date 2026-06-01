import { ContextMenu } from "./handlers/contextMenuHandler.js"
import { normalizePath, parseTwemojiString, copyText } from "./lib.js"

function isPathCommentIsCurrent(currentPath, commentPath) {
    currentPath = normalizePath(currentPath)
    commentPath = normalizePath(commentPath)

    return currentPath.endsWith(commentPath)
}

let currentCodeContextMenu = null;

export function destroyCodeContextMenu() {
    if (currentCodeContextMenu) {
        if (currentCodeContextMenu.context && currentCodeContextMenu.context.parentNode) {
            currentCodeContextMenu.context.parentNode.removeChild(currentCodeContextMenu.context);
        }
        if (currentCodeContextMenu.scope) {
            currentCodeContextMenu.scope = null;
        }
        currentCodeContextMenu = null;
    }
    
    const allContextMenus = document.querySelectorAll(".context-menu:not(.hidden)");
    allContextMenus.forEach(menu => {
        if (menu.parentNode) {
            menu.parentNode.removeChild(menu);
        }
    });
}

export async function initCodeContextMenu(currentPath, pathContext, editor) {
    destroyCodeContextMenu();
    
    const uniqueMenuId = "codeContextMenu_" + Math.random().toString(36).substr(2, 9);
    const codeContextMenu = new ContextMenu(uniqueMenuId)
    currentCodeContextMenu = codeContextMenu;

    codeContextMenu.bindOn(editor.container)

    codeContextMenu.add({
        id: "copyLine", icon: "content_copy", content: "Copy line", shortcut: "Ctrl+C", func: () => {
            let currentLine = editor.getSelectionRange().start.row
            copyText(editor.session.getLine(currentLine))
        }
    })
    codeContextMenu.add({
        id: "copyAll", icon: "copy_all", content: "Copy all content", func: () => {
            copyText(editor.getValue())
        }
    })
    codeContextMenu.add({ type: "divider" })

    codeContextMenu.on("open", (data) => { console.log(data.element) })
}