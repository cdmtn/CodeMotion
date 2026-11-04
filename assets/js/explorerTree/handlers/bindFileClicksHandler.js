import { openTab, activateTab, closeTab, previewTabPath, promotePreview } from "../tabHandler.js";
import { applyExplorerDiagnostics } from "../explorerDiagnostics.js";

export function bindFileEl(fileEl, { scopeEl, tabsByPath, recentlyClosed, pathContext, settings }) {
    let clickTimer = null;

    async function openFile(filePath, asPreview) {
        const name = fileEl.getAttribute("data-name") || filePath.split(/[\\/]/).pop();
        const extension = (fileEl.getAttribute("data-extension") || "").toLowerCase();
        const cached = recentlyClosed.get(filePath);
        const isBinaryImage = ["png", "jpg", "jpeg", "gif", "webp", "ico", "bmp"].includes(extension);
        const content = cached ? cached.content : (isBinaryImage ? "" : await window.electron.readFileContent(filePath));

        if (previewTabPath && previewTabPath !== filePath) {
            closeTab(previewTabPath);
        }

        openTab(filePath, content, extension, name, pathContext, false, settings, asPreview);
    }

    fileEl.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        if (ev.detail === 1) {
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
                return;
            }
            clickTimer = setTimeout(async () => {
                clickTimer = null;
                (scopeEl || fileEl.closest(".explorer-elements") || document).querySelectorAll(".file[data-path]").forEach(btn => btn.classList.remove("active"));
                fileEl.classList.add("active");

                const filePath = fileEl.getAttribute("data-path");

                if (tabsByPath.has(filePath)) {
                    activateTab(tabsByPath.get(filePath).tabEl);
                    return;
                }

                await openFile(filePath, true);
            }, 50);
        }
    });

    fileEl.addEventListener("dblclick", async (ev) => {
        if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
        }
        const filePath = fileEl.getAttribute("data-path");

        if (tabsByPath.has(filePath)) {
            promotePreview(filePath);
        } else {
            await openFile(filePath, false);
        }
    });
}

export function bindFileClicks({ scopeEl, tabsByPath, recentlyClosed, pathContext, settings }) {
    scopeEl.querySelectorAll(".file[data-path]").forEach(fileEl => {
        bindFileEl(fileEl, { scopeEl, tabsByPath, recentlyClosed, pathContext, settings });
    });

    applyExplorerDiagnostics(scopeEl);
}
