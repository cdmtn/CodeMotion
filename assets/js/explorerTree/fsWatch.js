import { renderNodes } from "./render.js";
import { bindFileEl } from "./handlers/bindFileClicksHandler.js";

let unsubscribe = null;
let current = null;

const norm = (p) => (p || "").replace(/\\/g, "/").replace(/\/+$/, "");
const isHeavy = (p) => /(^|\/)(node_modules|\.git|\.hg|\.svn|dist|dist-esm)(\/|$)/.test(p);

function childEntries(container) {
    return Array.from(container.children).filter(
        (el) => el.classList.contains("file") || el.classList.contains("dir") || el.classList.contains("symlink")
    );
}

function findContainer(parentPath) {
    const target = norm(parentPath);
    const rootPath = norm(current.pathContext?.rootPath);

    if (target === rootPath) return current.filesPanel;

    for (const dirEl of current.filesPanel.querySelectorAll(".dir[data-path]")) {
        if (norm(dirEl.dataset.path) === target) {
            if (dirEl.dataset.loaded === "false") return null;
            return dirEl.querySelector(":scope > .dir-content");
        }
    }
    return null;
}

function insertSorted(container, el, isDir, name) {
    const lname = name.toLowerCase();

    for (const ex of childEntries(container)) {
        const exIsDir = ex.classList.contains("dir");
        const exName = (ex.dataset.name || ex.querySelector(".explorer-name")?.textContent || "").toLowerCase();

        if (isDir) {
            if (!exIsDir) { container.insertBefore(el, ex); return; }
            if (lname.localeCompare(exName) < 0) { container.insertBefore(el, ex); return; }
        } else if (!exIsDir && lname.localeCompare(exName) < 0) {
            container.insertBefore(el, ex);
            return;
        }
    }

    container.appendChild(el);
}

async function applyChange({ type, path: changedPath }) {
    if (!current || !changedPath) return;

    const cp = norm(changedPath);
    if (isHeavy(cp)) return;

    const sep = Math.max(changedPath.lastIndexOf("/"), changedPath.lastIndexOf("\\"));
    const parentPath = changedPath.slice(0, sep);
    const name = cp.slice(cp.lastIndexOf("/") + 1);

    const container = findContainer(parentPath);
    if (!container) return;

    const isDir = type === "addDir" || type === "unlinkDir";

    if (type === "add" || type === "addDir") {
        if (childEntries(container).some((el) => norm(el.dataset.path) === cp)) return;

        const node = { name, path: changedPath, type: isDir ? "dir" : "file", ignored: false, loaded: false };
        const html = await renderNodes([node]);
        if (!html) return;

        const tmp = document.createElement("div");
        tmp.innerHTML = html.trim();
        const el = tmp.firstElementChild;
        if (!el) return;

        insertSorted(container, el, isDir, name);
        if (!isDir) bindFileEl(el, { scopeEl: current.filesPanel, ...current.ctx });
    } else {
        const el = childEntries(container).find((c) => norm(c.dataset.path) === cp);
        if (el) el.remove();
    }
}

export function initFsWatch({ filesPanel, pathContext, settings, tabsByPath, recentlyClosed }) {
    if (!window.electron?.watchFolder) return;

    current = {
        filesPanel,
        pathContext,
        ctx: { tabsByPath, recentlyClosed, pathContext, settings },
    };

    if (!unsubscribe) {
        unsubscribe = window.electron.onExplorerFsChange((data) => {
            applyChange(data).catch((err) => console.warn("fs change apply failed:", err));
        });
    }

    window.electron.watchFolder(pathContext?.rootPath);
}

export function stopFsWatch() {
    current = null;
    window.electron?.unwatchFolder?.();
}
