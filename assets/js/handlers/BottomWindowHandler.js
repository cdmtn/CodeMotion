export class BottomWindow {
    static windows = new Map()
    static settings = { app: { reduceMotion: false } }

    constructor(id, { title } = {}) {
        if (BottomWindow.windows.has(id)) {
            return BottomWindow.windows.get(id)
        }

        this.id = id
        this.title = title
        this.win = null
        this.winContent = null
        this.isAutoScrollBottom = false
        this.hideHandlers = []
        this.resizeState = null
        this.resizeFrame = null
        this.nextResizeHeight = null
        this.resizePreview = null
        this.handleResizeMove = this.#handleResizeMove.bind(this)
        this.handleResizeEnd = this.#handleResizeEnd.bind(this)

        this.#loadSettings()
        this.#init()
        BottomWindow.windows.set(id, this)
    }

    async #loadSettings() {
        if (!window.electron?.readSettings) return

        try {
            BottomWindow.settings = await window.electron.readSettings()
        } catch (error) {
            console.warn("[BottomWindow] Could not read settings", error)
        }
    }

    #init() {
        const win = document.createElement("div")
        win.classList.add("bottom-window", "hidden")
        win.id = this.id

        win.innerHTML = `
            <div class="bottom-window__resize-handle"></div>
            <div class="bottom-window__header">
                ${this.title ? `<p class="bottom-window__title">${this.title}</p>` : ""}
                <span class="material-symbols-rounded" id="bottomWindowClose">close</span>
            </div>
            <div class="bottom-window__content">
                <span class="translucent" id="placeholder">There is nothing here yet</span>
            </div>
        `

        document
            .querySelector(".bottom-window__container")
            .appendChild(win)

        this.win = win
        this.winContent = win.querySelector(".bottom-window__content")
        this.isFullscreen = false

        win.querySelector("#bottomWindowClose")
            .addEventListener("click", () => this.hide())

        win.querySelector(".bottom-window__resize-handle")
            .addEventListener("pointerdown", (event) => this.#handleResizeStart(event))
    }

    #handleResizeStart(event) {
        if (this.isFullscreen) return

        const wrapper = this.win.closest(".code-wrapper")
        const wrapperRect = wrapper?.getBoundingClientRect()
        const winRect = this.win.getBoundingClientRect()
        const reduceMotion = BottomWindow.settings?.app?.reduceMotion === true

        this.resizeState = {
            bottom: winRect.bottom,
            maxHeight: Math.max(180, (wrapperRect?.height || window.innerHeight) - 120),
            reduceMotion
        }

        document.body.classList.add("bottom-window-resizing")
        this.win.classList.add("resizing")
        this.win.style.transition = "none"
        this.win.style.maxHeight = "none"

        this.win.dispatchEvent(new CustomEvent("bottom-window-resize-start"))

        if (reduceMotion) {
            this.#showResizePreview(winRect)
        }

        document.addEventListener("pointermove", this.handleResizeMove)
        document.addEventListener("pointerup", this.handleResizeEnd, { once: true })
        document.addEventListener("pointercancel", this.handleResizeEnd, { once: true })

        event.preventDefault()
    }

    #handleResizeMove(event) {
        if (!this.resizeState) return

        const minHeight = 160
        const nextHeight = this.resizeState.bottom - event.clientY
        const height = Math.min(Math.max(nextHeight, minHeight), this.resizeState.maxHeight)

        this.nextResizeHeight = height

        if (this.resizeFrame) return

        this.resizeFrame = requestAnimationFrame(() => {
            this.resizeFrame = null
            if (this.nextResizeHeight == null) return

            if (this.resizeState?.reduceMotion) {
                this.#moveResizePreview(this.resizeState.bottom - this.nextResizeHeight)
                return
            }

            this.#setHeight(this.nextResizeHeight)
        })
    }

    #handleResizeEnd() {
        const wasResizing = Boolean(this.resizeState)
        const applyHeight = this.nextResizeHeight

        if (this.resizeFrame) {
            cancelAnimationFrame(this.resizeFrame)
            this.resizeFrame = null
        }

        if (applyHeight != null && this.win) {
            this.#setHeight(applyHeight)
        }

        this.#hideResizePreview()
        this.resizeState = null
        this.nextResizeHeight = null
        document.body.classList.remove("bottom-window-resizing")
        this.win?.classList.remove("resizing")
        if (this.win) this.win.style.transition = ""

        document.removeEventListener("pointermove", this.handleResizeMove)
        document.removeEventListener("pointerup", this.handleResizeEnd)
        document.removeEventListener("pointercancel", this.handleResizeEnd)

        if (wasResizing) {
            this.win?.dispatchEvent(new CustomEvent("bottom-window-resize-end"))
        }
    }

    #setHeight(height) {
        this.win.style.height = `${height}px`
    }

    #showResizePreview(winRect) {
        this.#hideResizePreview()

        const preview = document.createElement("div")
        preview.className = "bottom-window__resize-preview"
        preview.style.left = `${winRect.left}px`
        preview.style.top = `${winRect.top}px`
        preview.style.width = `${winRect.width}px`

        document.body.appendChild(preview)
        this.resizePreview = preview
    }

    #moveResizePreview(top) {
        if (!this.resizePreview) return

        this.resizePreview.style.top = `${top}px`
    }

    #hideResizePreview() {
        this.resizePreview?.remove()
        this.resizePreview = null
    }

    removeClose() {
        if(this.win.querySelector("#bottomWindowClose")) {
            this.win.querySelector("#bottomWindowClose").remove()
        }
    }

    static get(id) {
        return BottomWindow.windows.get(id)
    }

    static log(...args) {
        console.log(`[BottomWindow]`, ...args)
    }

    autoScrollBottom() {
        this.isAutoScrollBottom
    }

    clear() {
        this.winContent.innerHTML = ""
    }

    show() {
        this.win.classList.remove("hidden")

        if(this.isFullscreen) {
            document.querySelector(".bottom-window__container").classList.add("full")
        }
        else {
            document.querySelector(".bottom-window__container").classList.remove("full")
        }
    }

    hide() {
        this.win.classList.add("hidden")

        if(this.isFullscreen) {
            document.querySelector(".bottom-window__container").classList.remove("full")
        }
        else {
            document.querySelector(".bottom-window__container").classList.remove("full")
        }

        this.hideHandlers.forEach(handler => handler())
    }

    onHide(handler) {
        this.hideHandlers.push(handler)
    }

    add(el) {
        const placeholder = this.winContent.querySelector("#placeholder")
        if (placeholder) {
            placeholder.remove()
        }

        this.winContent.appendChild(el)

        if(this.isAutoScrollBottom) {
            this.winContent.scrollTop = this.winContent.scrollHeight
        }
    }

    set(content) {
        const placeholder = this.winContent.querySelector("#placeholder")
        if (placeholder) {
            placeholder.remove()
        }

        this.winContent.innerHTML = content
    }

    toggle() {
        this.win.classList.toggle("hidden")
    }

    fullscreen(state = true) {
        this.isFullscreen = state

        if(state) {
            this.win.classList.add("fullscreen")
        }
        else {
            this.win.classList.remove("fullscreen")
        }
    }

    state() {
        return this.win.classList.contains("hidden") ? "hidden" : "show"
    }

    destroy() {
        this.#handleResizeEnd()
        this.win?.remove()
        BottomWindow.windows.delete(this.id)
    }
}

export function closeAllWindows() {
    BottomWindow.windows.forEach(window => window.hide())
    document.querySelector(".bottom-window__container").classList.remove("full")
}
