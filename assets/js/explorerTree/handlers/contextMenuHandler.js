import { BottomWindow } from "../../handlers/BottomWindowHandler.js";
import { Console } from "../../handlers/terminalHandler.js";
import { copyText, normalizePath } from "../../lib.js";
import { closeTab, updateTabPath } from "../tabHandler.js";
import { renderNodes } from "../render.js";
import { bindFileClicks } from "./bindFileClicksHandler.js";

let menuEl = null;

function getNameFromPath(targetPath) {
    return normalizePath(targetPath).split("/").filter(Boolean).pop() || targetPath;
}

function getDirname(targetPath) {
    const normalized = normalizePath(targetPath);
    const parts = normalized.split("/");
    parts.pop();
    return parts.join("/") || normalized;
}

function joinPath(basePath, name) {
    return `${normalizePath(basePath).replace(/\/$/, "")}/${name}`;
}

function relativePath(targetPath, pathContext = {}) {
    const rootPath = normalizePath(pathContext.rootPath || "");
    const normalized = normalizePath(targetPath);

    if (!rootPath || !normalized.startsWith(rootPath)) {
        return normalized;
    }

    return normalized.slice(rootPath.length).replace(/^\//, "");
}

function ensureMenu() {
    if (menuEl) return menuEl;

    menuEl = document.createElement("div");
    menuEl.classList.add("context-menu", "hidden", "explorer-context-menu");
    document.body.appendChild(menuEl);

    menuEl.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
    });

    document.addEventListener("click", hideMenu);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") hideMenu();
    });
    window.addEventListener("blur", hideMenu);

    return menuEl;
}

function hideMenu() {
    if (!menuEl || menuEl.classList.contains("hidden")) return;
    menuEl.classList.add("closing");
    const onEnd = () => {
        menuEl.removeEventListener("transitionend", onEnd);
        if (menuEl.classList.contains("closing")) {
            menuEl.classList.add("hidden");
        }
    };
    menuEl.addEventListener("transitionend", onEnd);
}

function addItem({ content, shortcut, disabled, action, icon }) {
    const item = document.createElement("div");
    item.classList.add("context-menu__item");
    if (disabled) item.classList.add("disabled");

    const iconHTML = icon ? `<span class="material-symbols-rounded">${icon}</span>` : "";

    item.innerHTML = `
        <div class="context-menu__item-block ${icon ? "" : "no-icon"}">
            ${iconHTML}
            <div class="content">${content}</div>
        </div>
        <div class="context-menu__item-block">
            ${shortcut ? `<div class="shortcut">${shortcut}</div>` : ""}
        </div>
    `;

    item.addEventListener("click", async (event) => {
        event.stopPropagation();
        hideMenu();
        if (disabled || !action) return;
        await action();
    });

    menuEl.appendChild(item);
}

function addDivider() {
    const divider = document.createElement("div");
    divider.className = "context-menu__item-divider";
    divider.innerHTML = "<div></div>";
    menuEl.appendChild(divider);
}

function showMenu(event, items) {
    const menu = ensureMenu();
    menu.innerHTML = "";

    document.querySelectorAll(".context-menu").forEach(m => {
        if (m !== menu) m.classList.add("hidden");
    });

    for (const item of items) {
        if (item.type === "divider") {
            addDivider();
        } else {
            addItem(item);
        }
    }

    const wasHidden = menu.classList.contains("hidden");
    menu.classList.remove("hidden");
    if (wasHidden) {
        menu.classList.add("closing");
        void menu.offsetWidth;
        menu.classList.remove("closing");
    }

    const edgeGap = 8;
    const maxLeft = window.innerWidth - menu.offsetWidth - edgeGap;
    const maxTop = window.innerHeight - menu.offsetHeight - edgeGap;
    const left = Math.max(edgeGap, Math.min(event.clientX, maxLeft));
    const top = Math.max(edgeGap, Math.min(event.clientY, maxTop));

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
}

async function refreshFolder(dirElement, context) {
    if (!dirElement) return;

    const content = Array.from(dirElement.children).find(child => child.classList.contains("dir-content"));
    if (!content) return;

    const children = await window.electron.readDirTree(dirElement.dataset.path, { maxDepth: 0, ignoreRoot: context.pathContext?.rootPath });
    content.innerHTML = await renderNodes(children);
    dirElement.dataset.loaded = "true";
    dirElement.classList.add("expanded");
    bindFileClicks({
        scopeEl: content,
        tabsByPath: context.tabsByPath,
        recentlyClosed: context.recentlyClosed,
        pathContext: context.pathContext,
        settings: context.settings
    });
}

async function refreshRoot(context) {
    if (!context.container || !context.pathContext?.rootPath) return;

    const children = await window.electron.readDirTree(context.pathContext.rootPath, { maxDepth: 0, ignoreRoot: context.pathContext.rootPath });
    context.container.innerHTML = await renderNodes(children);
    bindFileClicks({
        scopeEl: context.container,
        tabsByPath: context.tabsByPath,
        recentlyClosed: context.recentlyClosed,
        pathContext: context.pathContext,
        settings: context.settings
    });
}

function getCreateContainer(context, dirElement) {
    if (!dirElement) return context.container;

    const content = Array.from(dirElement.children).find(child => child.classList.contains("dir-content"));
    if (!content) return null;

    dirElement.classList.add("expanded");
    return content;
}

function createPendingElement(type) {
    const element = document.createElement("div");
    element.className = "file explorer-pending-create";
    element.innerHTML = `<input class="explorer-rename-input" value="${type === "file" ? "untitled.txt" : "New Folder"}">`;
    return element;
}

function startCreateChild(type, dirPath, context, dirElement = null) {
    if (!dirPath) {
        window.alert("No folder selected");
        return;
    }

    const method = type === "file" ? "createFile" : "createFolder";
    const canCreateFileWithSave = type === "file" && typeof window.electron?.saveFile === "function";

    if (typeof window.electron?.[method] !== "function" && !canCreateFileWithSave) {
        window.alert("File creation API is not loaded. Restart CodeMotion and try again.");
        return;
    }

    const container = getCreateContainer(context, dirElement);
    if (!container) return;

    const pending = createPendingElement(type);
    const input = pending.querySelector("input");
    container.prepend(pending);
    input.focus();
    input.select();

    let finished = false;

    async function finish(save) {
        if (finished) return;
        finished = true;

        const cleanName = input.value.trim();
        pending.remove();

        if (!save || !cleanName) return;

        const targetPath = joinPath(dirPath, cleanName);
        const result = typeof window.electron?.[method] === "function"
            ? await window.electron[method](targetPath)
            : await window.electron.saveFile(targetPath, "");

        if (!result.success) {
            console.error(result.error);
            window.alert(result.error || `Failed to create ${type}`);
            return;
        }

        if (dirElement) {
            await refreshFolder(dirElement, context);
        } else {
            await refreshRoot(context);
        }
    }

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            finish(true);
        }
        if (event.key === "Escape") {
            event.preventDefault();
            finish(false);
        }
    });

    input.addEventListener("blur", () => finish(false));
}

async function commitRename(targetPath, targetElement, newName) {
    const oldName = getNameFromPath(targetPath);
    if (!newName || newName === oldName) return;

    if (typeof window.electron?.renamePath !== "function") {
        window.alert("Rename API is not loaded. Restart CodeMotion and try again.");
        return;
    }

    const newPath = joinPath(getDirname(targetPath), newName);
    const result = await window.electron.renamePath(targetPath, newPath);

    if (!result.success) {
        console.error(result.error);
        window.alert(result.error || "Failed to rename");
        return;
    }

    if (targetElement.classList.contains("dir")) {
        targetElement.dataset.path = result.path;
        targetElement.dataset.loaded = "false";
        targetElement.classList.remove("expanded");
        const content = Array.from(targetElement.children).find(child => child.classList.contains("dir-content"));
        if (content) content.innerHTML = "";
    } else {
        targetElement.dataset.path = result.path;
        targetElement.dataset.name = newName;
        updateTabPath(targetPath, result.path, newName);
    }

    return result.path;
}

function renameTarget(targetPath, targetElement) {
    const nameEl = targetElement.querySelector(".explorer-name");
    if (!nameEl) return;

    const oldName = getNameFromPath(targetPath);
    const input = document.createElement("input");
    input.className = "explorer-rename-input";
    input.value = oldName;

    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;

    async function finish(save) {
        if (finished) return;
        finished = true;

        const nextName = input.value.trim();
        const span = document.createElement("span");
        span.className = "explorer-name";
        span.textContent = oldName;
        input.replaceWith(span);

        if (!save || !nextName || nextName === oldName) return;

        const newPath = await commitRename(targetPath, targetElement, nextName);
        if (newPath) {
            span.textContent = nextName;
        }
    }

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            finish(true);
        }
        if (event.key === "Escape") {
            event.preventDefault();
            finish(false);
        }
    });

    input.addEventListener("blur", () => finish(false));
}

async function deleteTarget(targetPath, targetElement, context) {
    const ok = window.confirm(`Delete ${getNameFromPath(targetPath)}?`);
    if (!ok) return;

    const result = await window.electron.removeByPath(targetPath);
    if (!result.success) {
        console.error(result.error);
        return;
    }

    const normalizedTarget = normalizePath(targetPath);
    for (const path of [...context.tabsByPath.keys()]) {
        const normalizedPath = normalizePath(path);
        if (normalizedPath === normalizedTarget || normalizedPath.startsWith(`${normalizedTarget}/`)) {
            closeTab(path);
        }
    }

    targetElement.remove();
}

function openTerminal(targetPath, isFolder) {
    const terminalPath = isFolder ? targetPath : getDirname(targetPath);
    const terminalWindow = new BottomWindow("globalTerminal", { title: "Terminal" });
    terminalWindow.show();
    terminalWindow.clear();
    terminalWindow.autoScrollBottom();
    terminalWindow.win.classList.add("console");

    new Console(terminalWindow, terminalPath);
}

function fileItems(fileEl, context) {
    const filePath = fileEl.dataset.path;
    const parentDirElement = fileEl.closest(".dir");
    const targetDirPath = parentDirElement?.dataset.path || getDirname(filePath);

    return [
        { content: "New File...", icon: "note_add", action: () => startCreateChild("file", targetDirPath, context, parentDirElement) },
        { content: "New Folder...", icon: "create_new_folder", action: () => startCreateChild("folder", targetDirPath, context, parentDirElement) },
        { type: "divider" },
        { content: "Open With...", icon: "open_in_new", disabled: true },
        { content: "Reveal in File Explorer", icon: "folder_open", shortcut: "Shift+Alt+R", action: () => window.electron.revealInFileExplorer(filePath) },
        { content: "Open in Integrated Terminal", icon: "terminal", action: () => openTerminal(filePath, false) },
        { type: "divider" },
        { content: "Cut", icon: "content_cut", shortcut: "Ctrl+X", disabled: true },
        { content: "Copy", icon: "content_copy", shortcut: "Ctrl+C", disabled: true },
        { content: "Paste", icon: "content_paste", shortcut: "Ctrl+V", disabled: true },
        { type: "divider" },
        { content: "Copy Path", icon: "content_copy", shortcut: "Shift+Alt+C", action: () => copyText(filePath) },
        { content: "Copy Relative Path", icon: "content_copy", shortcut: "Ctrl+K Ctrl+Shift+C", action: () => copyText(relativePath(filePath, context.pathContext)) },
        { type: "divider" },
        { content: "Rename...", icon: "edit", shortcut: "F2", action: () => renameTarget(filePath, fileEl) },
        { content: "Delete", icon: "delete", shortcut: "Delete", action: () => deleteTarget(filePath, fileEl, context) }
    ];
}

function folderItems(dirElement, context) {
    const dirPath = dirElement.dataset.path;

    return [
        { content: "New File...", icon: "note_add", action: () => startCreateChild("file", dirPath, context, dirElement) },
        { content: "New Folder...", icon: "create_new_folder", action: () => startCreateChild("folder", dirPath, context, dirElement) },
        { content: "Reveal in File Explorer", icon: "folder_open", shortcut: "Shift+Alt+R", action: () => window.electron.revealInFileExplorer(dirPath) },
        { content: "Open in Integrated Terminal", icon: "terminal", action: () => openTerminal(dirPath, true) },
        { type: "divider" },
        { content: "Find in Folder...", icon: "search", shortcut: "Shift+Alt+F", disabled: true },
        { type: "divider" },
        { content: "Cut", icon: "content_cut", shortcut: "Ctrl+X", disabled: true },
        { content: "Copy", icon: "content_copy", shortcut: "Ctrl+C", disabled: true },
        { type: "divider" },
        { content: "Copy Path", icon: "content_copy", shortcut: "Shift+Alt+C", action: () => copyText(dirPath) },
        { content: "Copy Relative Path", icon: "content_copy", shortcut: "Ctrl+K Ctrl+Shift+C", action: () => copyText(relativePath(dirPath, context.pathContext)) },
        { type: "divider" },
        { content: "Rename...", icon: "edit", shortcut: "F2", action: () => renameTarget(dirPath, dirElement) },
        { content: "Delete", icon: "delete", shortcut: "Delete", action: () => deleteTarget(dirPath, dirElement, context) }
    ];
}

function rootItems(context) {
    const rootPath = context.pathContext?.rootPath;

    return [
        { content: "New File...", icon: "note_add", action: () => startCreateChild("file", rootPath, context) },
        { content: "New Folder...", icon: "create_new_folder", action: () => startCreateChild("folder", rootPath, context) },
        { type: "divider" },
        { content: "Reveal in File Explorer", icon: "folder_open", shortcut: "Shift+Alt+R", action: () => window.electron.revealInFileExplorer(rootPath) },
        { content: "Open in Integrated Terminal", icon: "terminal", action: () => openTerminal(rootPath, true) },
        { type: "divider" },
        { content: "Copy Path", icon: "content_copy", shortcut: "Shift+Alt+C", action: () => copyText(rootPath) }
    ];
}

export function initializeExplorerContextMenu(container, context) {
    if (container._explorerContextMenuHandler) {
        container.removeEventListener("contextmenu", container._explorerContextMenuHandler);
    }
    if (container._explorerCleanup) {
        container._explorerCleanup();
        container._explorerCleanup = null;
    }

    context.container = container;

    let explorerFocused = false;

    const onContainerMousedown = () => { explorerFocused = true; };
    const onOutsideMousedown = (e) => {
        if (!container.contains(e.target)) explorerFocused = false;
    };

    const onDirClick = (e) => {
        const dirTitle = e.target.closest(".dir-title");
        if (!dirTitle) return;
        const dirEl = dirTitle.closest(".dir[data-path]");
        if (!dirEl) return;
        container.querySelectorAll(".file.active, .dir.active").forEach(el => el.classList.remove("active"));
        dirEl.classList.add("active");
    };

    const onFileClick = (e) => {
        const fileEl = e.target.closest(".file[data-path]");
        if (!fileEl) return;
        container.querySelectorAll(".dir.active").forEach(el => el.classList.remove("active"));
    };

    const onKeydown = (e) => {
        if (!explorerFocused) return;
        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

        const activeEl =
            container.querySelector(".file.active[data-path]") ||
            container.querySelector(".dir.active[data-path]");
        if (!activeEl) return;

        const targetPath = activeEl.dataset.path;

        if (e.key === "F2") {
            e.preventDefault();
            renameTarget(targetPath, activeEl);
        } else if (e.key === "Delete") {
            e.preventDefault();
            deleteTarget(targetPath, activeEl, context);
        }
    };

    container.addEventListener("mousedown", onContainerMousedown);
    container.addEventListener("click", onDirClick);
    container.addEventListener("click", onFileClick, true);
    document.addEventListener("mousedown", onOutsideMousedown, true);
    document.addEventListener("keydown", onKeydown);

    container._explorerCleanup = () => {
        container.removeEventListener("mousedown", onContainerMousedown);
        container.removeEventListener("click", onDirClick);
        container.removeEventListener("click", onFileClick, true);
        document.removeEventListener("mousedown", onOutsideMousedown, true);
        document.removeEventListener("keydown", onKeydown);
    };

    const handler = (event) => {
        const dirTitle = event.target.closest(".dir-title");
        const fileEl = event.target.closest(".file[data-path]");

        event.preventDefault();
        event.stopPropagation();

        if (dirTitle) {
            const dirElement = dirTitle.closest(".dir");
            if (dirElement) showMenu(event, folderItems(dirElement, context));
            return;
        }

        if (fileEl) {
            showMenu(event, fileItems(fileEl, context));
            return;
        }

        showMenu(event, rootItems(context));
    };

    container._explorerContextMenuHandler = handler;
    container.addEventListener("mousedown", (event) => {
        if (event.button !== 2) return;
        handler(event);
    });
    container.addEventListener("contextmenu", (event) => {
        event.preventDefault();
    });
}