import { idify } from "../lib.js"

export class _TopBarElement {
    static instances = new Map()

    constructor(id) {
        const normalizedId = idify(id)

        if (_TopBarElement.instances.has(normalizedId)) {
	        return _TopBarElement.instances.get(normalizedId)
        }

	    this.parent = document.querySelector("#topbarCenter .status-indicator")

        let item = document.querySelector(`#${normalizedId}`)

        if (!item) {
            item = document.createElement("div")
            item.className = "topbar-center hidden"
            item.id = normalizedId

            this.parent.before(item)
        }

        this.item = item
        this._animationToken = 0

        _TopBarElement.instances.set(normalizedId, this)
    }

    content({ text, icon, type, image }) {
        this.item.innerHTML = ""

        const container = document.createElement("div")
        container.className = "topbar-center__row"

        if(image) {
            icon = false

            const imageEl = document.createElement("img")
            imageEl.className = "topbar-center__image-icon"
            imageEl.src = image
            imageEl.id = "icon"

            container.appendChild(imageEl)
        }

        if (icon) {
            const iconEl = document.createElement("span")
            iconEl.className = "material-symbols-rounded"
            iconEl.id = "icon"
            iconEl.textContent = icon

            container.appendChild(iconEl)
        }

        if (text) {
            const textEl = document.createElement("div")
            textEl.className = "topbar-center__text"
            textEl.textContent = text

            container.appendChild(textEl)
        }

        if (type) {
            const types = ["default", "notification", "danger"]

            this.item.classList.remove(...types)

            if (types.includes(type)) {
                this.item.classList.add(type)
            }
        }

        this.item.appendChild(container)
    }

    show() {
        const el = this.item
        const icon = el.querySelector("#icon")
        const text = el.querySelector(".topbar-center__text")

        const token = ++this._animationToken

        el.classList.remove("hidden")

        if (icon) icon.style.marginLeft = "0px"
        if (text) text.classList.remove("hidden")

        void el.offsetHeight

        const targetWidth = el.scrollWidth

        el.style.maxWidth = targetWidth + "px"
        el.style.minWidth = targetWidth + "px"
    }

    hide({ iconVisible = false } = {}) {
        const el = this.item
        const icon = el.querySelector("#icon")
        const text = el.querySelector(".topbar-center__text")

        const token = ++this._animationToken

        if (!iconVisible) {
            el.style.maxWidth = "0px"
            el.style.minWidth = "0px"
        } else {
            el.style.maxWidth = "20px"
            el.style.minWidth = "20px"

            if (icon) icon.style.marginLeft = "-5px"
            if (text) text.classList.add("hidden")
        }
    }

    on(event, callback) {
        const events = {
            hover: "mouseenter",
            unhover: "mouseleave",
            click: "click"
        }

        if (event in events) {
            this.item.addEventListener(events[event], () => {
                callback(this)
            })
        }
    }

    destroy() {
        this.item.remove()
        _TopBarElement.instances.delete(this.item.id)
    }
}