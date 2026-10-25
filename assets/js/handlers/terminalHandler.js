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
        this.cwd = this.toDir(startPath) || ""

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

        this.term.attachCustomKeyEventHandler((e) => {
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
        if (this.fitFrame) cancelAnimationFrame(this.fitFrame)
        this.term?.dispose()
    }
}
