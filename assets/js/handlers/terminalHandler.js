import { computeSuggestions, parseTyped } from "./terminalSuggestions.js"

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"])

export class Console {
    constructor(windowClass, startPath = null) {
        if (windowClass._console && !windowClass._console.disposed) {
            const existing = windowClass._console
            existing.fit()
            existing.term?.focus()
            return existing
        }
        windowClass._console = this

        this.console = windowClass
        windowClass.clear()
        this.body = windowClass.winContent

        const fitAddon = new FitAddon.FitAddon()

        this.term = new Terminal(
            {
                convertEol: true,
                cursorBlink: true,
                fontFamily: "Consolas, monospace",
                fontSize: 14,
                allowProposedApi: true
            }
        )

        this.term.loadAddon(fitAddon)
        this.term.open(this.body)
        this.term.focus()
        this.fitAddon = fitAddon
        this.disposed = false
        this.fitFrame = null
        this.isPanelResizing = false
        this.suggest = null
        this.swallowKey = null
        this.ghostKey = null
        this.cwd = this.toDir(startPath) || ""

        this.createGhost()

        this.handleResize = () => this.fit()
        this.handlePanelResizeStart = () => {
            this.isPanelResizing = true
        }
        this.handlePanelResizeEnd = () => {
            this.isPanelResizing = false
            this.fit()
        }

        this.fit()
        this.resizeObserver = new ResizeObserver(() => this.fit())
        this.resizeObserver.observe(this.body)
        window.addEventListener("resize", this.handleResize)
        this.console.win.addEventListener("bottom-window-resize-start", this.handlePanelResizeStart)
        this.console.win.addEventListener("bottom-window-resize-end", this.handlePanelResizeEnd)

        this.registerEvents()
        this.setupIPC()

        try {
            this.fitAddon.fit()
        } catch (_) { }

        this.initPTY()

        this.console.onHide(() => this.dispose())
    }

    toDir(p) {
        if (!p) return ""
        if (p.endsWith("/") || p.endsWith("\\")) return p
        const lastSlash = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"))
        if (lastSlash <= 0) return p
        const lastSegment = p.substring(lastSlash + 1)
        if (lastSegment.includes(".")) return p.substring(0, lastSlash)
        return p
    }

    initPTY() {
        if (window.electron?.initTerminal) {
            window.electron.initTerminal({
                cwd: this.cwd,
                cols: this.term.cols || 80,
                rows: this.term.rows || 24
            })
        }
    }

    fit() {
        if (this.disposed) return
        if (this.isPanelResizing) return
        if (this.fitFrame) return

        this.fitFrame = requestAnimationFrame(() => {
            this.fitFrame = null
            if (this.disposed) return
            this.fitAddon?.fit()

            if (window.electron?.resizeTerminal && this.term.cols && this.term.rows) {
                window.electron.resizeTerminal({
                    cols: this.term.cols,
                    rows: this.term.rows
                })
            }
        })
    }

    registerEvents() {
        this.term.onData((data) => {
            if (this.disposed) return
            window.electron?.sendInput?.(data)
        })

        this.renderDisposable = this.term.onRender(() => this.syncSuggestion())

        this.term.attachCustomKeyEventHandler((e) => {
            if (this.swallowKey) {
                if (e.type !== "keydown" && e.key === this.swallowKey) {
                    if (e.type === "keyup") this.swallowKey = null
                    return false
                }
                if (e.type === "keydown") this.swallowKey = null
            }

            if (e.type === "keydown") {
                if (this.suggest) {
                    if (this.handleSuggestKey(e)) {
                        this.consume(e)
                        return false
                    }
                } else if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (this.activateSuggestions()) {
                        this.consume(e)
                        return false
                    }
                }
            }

            if (e.ctrlKey && e.shiftKey && e.code === "KeyC") {
                const selection = this.term.getSelection()
                if (selection) navigator.clipboard.writeText(selection)
                return false
            }
            if (e.ctrlKey && e.shiftKey && e.code === "KeyV") {
                navigator.clipboard.readText().then(text => {
                    if (text) {
                        window.electron?.sendInput?.(text)
                    }
                })
                return false
            }
            return true
        })
    }

    consume(e) {
        e.preventDefault()
        e.stopPropagation()
        this.swallowKey = e.key
    }

    handleSuggestKey(e) {
        switch (e.key) {
            case "ArrowRight":
                this.cycleSuggestion(1)
                return true
            case "ArrowLeft":
                this.cycleSuggestion(-1)
                return true
            case "Enter":
                this.acceptSuggestion()
                return true
            case "Escape":
                this.deactivateSuggestions()
                return true
            case "Tab":
                return true
            default:
                if (!MODIFIER_KEYS.has(e.key)) this.deactivateSuggestions()
                return false
        }
    }

    readInput() {
        try {
            const buf = this.term.buffer.active
            const lineObj = buf.getLine(buf.baseY + buf.cursorY)
            const line = lineObj ? lineObj.translateToString(false) : ""
            if (line.slice(buf.cursorX).trim() !== "") return null

            const typed = parseTyped(line.slice(0, buf.cursorX))
            return typed != null ? typed : null
        } catch (_) {
            return null
        }
    }

    activateSuggestions() {
        const typed = this.readInput()
        if (typed == null) return false

        const result = computeSuggestions(typed)
        if (!result || !result.items.length) return false

        this.suggest = { items: result.items, index: 0, typed }
        this.renderGhost()
        return true
    }

    syncSuggestion() {
        if (!this.suggest) return

        const typed = this.readInput()
        if (typed == null) {
            this.deactivateSuggestions()
            return
        }

        if (typed !== this.suggest.typed) {
            const result = computeSuggestions(typed)
            if (!result || !result.items.length) {
                this.deactivateSuggestions()
                return
            }

            const label = this.suggest.items[this.suggest.index]?.label
            const index = result.items.findIndex(item => item.label === label)
            this.suggest = { items: result.items, index: index >= 0 ? index : 0, typed }
        }

        this.renderGhost()
    }

    cycleSuggestion(dir) {
        if (!this.suggest) return
        const n = this.suggest.items.length
        this.suggest.index = (this.suggest.index + dir + n) % n
        this.renderGhost()
    }

    acceptSuggestion() {
        if (!this.suggest) return
        const text = this.suggest.items[this.suggest.index]?.insertText
        this.deactivateSuggestions()
        if (text) window.electron?.sendInput?.(text)
    }

    deactivateSuggestions() {
        this.suggest = null
        this.hideGhost()
    }

    createGhost() {
        if (getComputedStyle(this.body).position === "static") {
            this.body.style.position = "relative"
        }

        this.ghostEl = document.createElement("div")
        this.ghostEl.className = "terminal-ghost"
        this.ghostEl.style.display = "none"
        this.body.appendChild(this.ghostEl)
    }

    renderGhost() {
        if (!this.suggest || !this.ghostEl) return this.hideGhost()

        const screen = this.term?.element?.querySelector(".xterm-screen")
        if (!screen || !this.term.rows || !this.term.cols) return this.hideGhost()

        const buf = this.term.buffer.active
        const row = buf.baseY + buf.cursorY - buf.viewportY
        if (row < 0 || row >= this.term.rows) return this.hideGhost()

        const text = this.suggest.items[this.suggest.index]?.insertText || ""
        const shown = text.slice(0, Math.max(0, this.term.cols - buf.cursorX))
        if (!shown) return this.hideGhost()

        const bodyRect = this.body.getBoundingClientRect()
        const { width: cellW, height: cellH } = this.cellMetrics(screen)
        const origin = this.cursorOrigin(screen, row, cellW, cellH)
        const left = origin.left - bodyRect.left
        const top = origin.top - bodyRect.top

        const key = `${shown}|${left}|${top}|${cellW}|${cellH}`
        if (key === this.ghostKey && this.ghostEl.style.display !== "none") return
        this.ghostKey = key

        const el = this.ghostEl
        el.style.left = `${left}px`
        el.style.top = `${top}px`
        el.style.height = `${cellH}px`
        el.style.lineHeight = `${cellH}px`
        el.style.fontFamily = this.term.options.fontFamily
        el.style.fontSize = `${this.term.options.fontSize}px`

        el.replaceChildren(...Array.from(shown, ch => {
            const cell = document.createElement("span")
            cell.style.width = `${cellW}px`
            cell.textContent = ch
            return cell
        }))
        el.style.display = "block"
        this.term.element?.classList.add("terminal-suggesting")
    }

    cellMetrics(screen) {
        const cell = this.term._core?._renderService?.dimensions?.css?.cell
        if (cell && cell.width > 0 && cell.height > 0) {
            return { width: cell.width, height: cell.height }
        }

        const rect = screen.getBoundingClientRect()
        return { width: rect.width / this.term.cols, height: rect.height / this.term.rows }
    }

    cursorOrigin(screen, row, cellW, cellH) {
        const cursorEl = this.term.element?.querySelector(".xterm-rows .xterm-cursor")
        if (cursorEl) {
            const rect = cursorEl.getBoundingClientRect()
            const rowRect = cursorEl.parentElement?.getBoundingClientRect()
            if (rect.width || rect.height) {
                return { left: rect.left, top: rowRect ? rowRect.top : rect.top }
            }
        }

        const screenRect = screen.getBoundingClientRect()
        return {
            left: screenRect.left + this.term.buffer.active.cursorX * cellW,
            top: screenRect.top + row * cellH
        }
    }

    hideGhost() {
        if (this.ghostEl) this.ghostEl.style.display = "none"
        this.term?.element?.classList.remove("terminal-suggesting")
        this.ghostKey = null
    }

    setupIPC() {
        if (window.electron && window.electron.onCommandResult) {
            this.commandResultHandler = (result) => {
                if (this.disposed) return
                this.handleTerminalResult(result)
            }

            this.removeCommandResultHandler = window.electron.onCommandResult(this.commandResultHandler)
        }
    }

    handleTerminalResult(result) {
        if (!result) return

        let output = ""
        let type = "output"

        if (typeof result === 'object') {
            type = result.type || "output"
            output = result.data || result.output || result.message || ""
        } else if (typeof result === 'string') {
            output = result
        } else {
            output = JSON.stringify(result)
        }

        if (!output) return

        switch (type) {
            case "error":
                this.term.write(output)
                break
            case "exit":
                this.term.write(output)
                break
            default:
                this.term.write(output)
        }
    }

    dispose() {
        if (this.disposed) return

        this.disposed = true
        if (this.console && this.console._console === this) {
            this.console._console = null
        }
        window.electron?.cleanupTerminal?.()
        this.resizeObserver?.disconnect()
        window.removeEventListener("resize", this.handleResize)
        this.console.win.removeEventListener("bottom-window-resize-start", this.handlePanelResizeStart)
        this.console.win.removeEventListener("bottom-window-resize-end", this.handlePanelResizeEnd)
        this.removeCommandResultHandler?.()
        this.renderDisposable?.dispose()
        if (this.fitFrame) cancelAnimationFrame(this.fitFrame)
        this.ghostEl?.remove()
        this.term?.dispose()
    }
}
