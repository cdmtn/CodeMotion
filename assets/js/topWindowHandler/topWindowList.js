import { isArray, isObject } from "../lib.js"

const instances = new Map()
let autoId = 0

document.addEventListener("click", (event) => {
    instances.forEach(instance => {
        if (
            !instance.window.contains(event.target) &&
            !instance.boundElements?.some(el => el.contains(event.target))
        ) {
            instance.hide()
        }
    })
})

export function destroyAllTopWindowLists() {
    instances.forEach(instance => instance.destroy())
    instances.clear()
}

export class TopWindowList {
    constructor(id = null, list = {}) {
        id ??= `top-window-${++autoId}`

        if (instances.has(id)) {
            return instances.get(id)
        }

        this.boundElements = []
        this.id = id
        this.list = list

        const window = document.createElement("div")
        window.classList.add("top-window", "list", "hidden")
        window.id = id

        if (isArray(list)) {
            list.forEach(item => {
                if (!isObject(item)) return

                const itemElement = document.createElement("div")
                itemElement.classList.add("top-window__list-item")

                const nameElement = document.createElement("div")

                if ("name" in item) {
                    nameElement.classList.add("top-window__list-item__name")
                    nameElement.textContent = item.name
                }

                if ("id" in item) {
                    nameElement.id = item.id
                }

                if ("icon" in item) {
                    const iconEl = document.createElement("img")
                    iconEl.src = item.icon

                    nameElement.prepend(iconEl)
                }

                itemElement.appendChild(nameElement)

                itemElement.addEventListener("click", () => {
                    this.hide()
                })

                window.appendChild(itemElement)
            })
        }

        this.window = window
        document.body.prepend(window)

        instances.set(id, this)
    }

    static get(id) {
        return instances.get(id)
    }

    on(eventName, cb) {
        if (eventName !== "click") return

        this.window.querySelectorAll(".top-window__list-item").forEach(e => {
            e.addEventListener("click", event => {
                cb({
                    target: event.target,
                    id: event.target.id,
                    name: event.target.textContent
                })
            })
        })
    }

    bind(element) {
        if (element instanceof HTMLElement) {
            this.boundElements.push(element)

            element.addEventListener("click", (event) => {
                event.stopPropagation()
                this.show()
            })
        }
    }

    show() {
        this.window.classList.remove("hidden")
    }

    hide() {
        this.window.classList.add("hidden")
    }

    destroy() {
        this.window.remove()
        instances.delete(this.id)
    }
}