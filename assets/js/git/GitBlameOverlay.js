import { currentPath, tabsByPath } from "../../components/tabHandler.js"
import { escapeHtml } from "../lib.js"

function relativePath(rootPath, filePath) {
    if (!rootPath || !filePath) return null

    const root = rootPath.replaceAll("\\", "/").replace(/\/$/, "")
    const file = filePath.replaceAll("\\", "/")

    if (!file.startsWith(root)) return null
    return file.slice(root.length).replace(/^\//, "")
}

export class GitBlameOverlay {
    constructor(pathContext) {
        this.pathContext = pathContext
        this.enabled = false
        this.overlay = document.createElement("div")
        this.overlay.className = "git-blame-overlay hidden"
        document.body.appendChild(this.overlay)
        this.afterRenderHandler = () => this.render()
        this.scrollHandler = () => this.render()
        this.resizeHandler = () => this.render()
    }

    async toggle() {
        if (this.enabled) {
            this.disable()
            return
        }

        await this.enable()
    }

    async enable() {
        const rec = tabsByPath.get(currentPath)
        const rel = relativePath(this.pathContext.rootPath, currentPath)
        if (!rec || !rel) return

        const response = await window.electron.gitBlame(this.pathContext.rootPath, rel)
        if (!response.success) {
            window.alert(response.error || "Could not load blame")
            return
        }

        this.enabled = true
        this.editor = rec.editor
        this.lines = response.result.lines
        this.overlay.classList.remove("hidden")
        this.editor.renderer.on("afterRender", this.afterRenderHandler)
        this.editor.session.on("changeScrollTop", this.scrollHandler)
        window.addEventListener("resize", this.resizeHandler)
        this.render()
    }

    disable() {
        this.enabled = false
        this.overlay.classList.add("hidden")
        this.overlay.innerHTML = ""

        if (this.editor) {
            this.editor.renderer.off("afterRender", this.afterRenderHandler)
            this.editor.session.off("changeScrollTop", this.scrollHandler)
        }

        window.removeEventListener("resize", this.resizeHandler)
        this.editor = null
        this.lines = []
    }

    render() {
        if (!this.enabled || !this.editor || !this.lines) return

        const renderer = this.editor.renderer
        const firstRow = renderer.layerConfig.firstRow
        const lastRow = renderer.layerConfig.lastRow
        const html = []

        for (let row = firstRow; row <= lastRow; row++) {
            const blame = this.lines[row]
            if (!blame) continue

            const line = this.editor.session.getLine(row)
            const coords = renderer.textToScreenCoordinates(row, Math.max(1, line.length + 2))
            const top = coords.pageY - renderer.lineHeight + 2
            const left = Math.min(coords.pageX + 12, window.innerWidth - 260)
            const text = `${blame.author || "Unknown"} · ${blame.shortHash} · ${blame.date}`

            html.push(`
                <div class="git-blame-inline" style="top:${top}px;left:${left}px" title="${escapeHtml(blame.summary || "")}">
                    ${escapeHtml(text)}
                </div>
            `)
        }

        this.overlay.innerHTML = html.join("")
    }
}
