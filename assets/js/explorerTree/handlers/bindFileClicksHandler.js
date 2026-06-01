import { openTab, activateTab } from "../tabHandler.js";

export function bindFileClicks({ scopeEl, tabsByPath, recentlyClosed, pathContext, settings }) {
    scopeEl.querySelectorAll(".file[data-path]").forEach(fileEl => {
        fileEl.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            scopeEl.querySelectorAll(".file[data-path]").forEach(btn => btn.classList.remove("active"));
            fileEl.classList.add("active");

            const filePath = fileEl.getAttribute("data-path");
            const name = fileEl.getAttribute("data-name") || filePath.split(/[\\/]/).pop();
            const extension = (fileEl.getAttribute("data-extension") || "").toLowerCase();

            if (tabsByPath.has(filePath)) {
                activateTab(tabsByPath.get(filePath).tabEl);
                return;
            }

            const cached = recentlyClosed.get(filePath);
            const content = cached ? cached.content : await window.electron.readFileContent(filePath);

            openTab(filePath, content, extension, name, pathContext, false, settings);
        });
    });
}