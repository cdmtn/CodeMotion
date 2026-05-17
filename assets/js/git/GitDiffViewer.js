import { BottomWindow } from "../handlers/BottomWindowHandler.js"
import { escapeHtml } from "../lib.js"

function renderLine(line, index) {
    const oldLine = line.oldLine == null ? "" : line.oldLine
    const newLine = line.newLine == null ? "" : line.newLine
    const prefix = line.type === "added"
        ? "+"
        : line.type === "removed"
            ? "-"
            : line.type === "hunk"
                ? "@"
                : ""
    const content = line.type === "added" || line.type === "removed"
        ? line.content.slice(1)
        : line.content

    return `
        <div class="git-diff-line ${line.type}" data-line="${index + 1}">
            <span class="git-diff-line__num">${oldLine}</span>
            <span class="git-diff-line__num">${newLine}</span>
            <span class="git-diff-line__prefix">${escapeHtml(prefix)}</span>
            <code>${escapeHtml(content)}</code>
        </div>
    `
}

function renderFile(file) {
    const title = file.newPath || file.oldPath || file.header || "Diff"

    return `
        <section class="git-diff-file">
            <div class="git-diff-file__header">
                <span class="material-symbols-rounded outline">difference</span>
                <span>${escapeHtml(title)}</span>
            </div>
            <div class="git-diff-file__body">
                ${file.lines.map(renderLine).join("")}
            </div>
        </section>
    `
}

export function showGitDiff({ title = "Git Diff", diff }) {
    const diffWindow = new BottomWindow("gitDiffViewer", { title })
    diffWindow.fullscreen()
    diffWindow.show()
    diffWindow.clear()

    if (!diff?.files?.length) {
        diffWindow.set(`<div class="git-empty-state">No diff available</div>`)
        return
    }

    diffWindow.win.classList.add("git-diff-window")
    diffWindow.set(`
        <div class="git-diff-viewer">
            ${diff.files.map(renderFile).join("")}
        </div>
    `)
}
