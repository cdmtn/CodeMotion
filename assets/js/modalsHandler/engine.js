// modal engine just for this ide
// just for note: i recreated this thing 3 times

import { renderModalBase } from "./components/base.js"

const backdrop = document.createElement("div")
backdrop.classList.add("backdrop", "hidden")

document.body.prepend(backdrop)

// function for object validation inside Modal class
export function valid(obj) {
    if (obj === undefined || obj === null || obj === false) return undefined

    if (Array.isArray(obj) && obj.length === 0) return undefined

    if (
        typeof obj === "object" &&
        !Array.isArray(obj) &&
        Object.keys(obj).length === 0
    ) return undefined

    return obj
}
// for arrays
export function validArray(obj) {
    if(valid(obj) == undefined) return undefined
    if(typeof obj == "object" && !Array.isArray(obj)) return Object.keys(obj)
    if(typeof obj != "object") return undefined

    return obj
}
// for urls
export function validHTTPS(url) {
    if(!url) return undefined
    if(!url.startsWith("https://")) return undefined

    return url
}
// for booleans
export function validBool(boolean) {
    if(typeof boolean == "boolean") return boolean
    else return undefined
}

export function err(text) {
    throw new Error(`[CodeMotion.Modals] ${text}`)
}
export function showBackdrop() {
    backdrop.classList.remove("hidden")
}
export function hideBackdrop() {
    backdrop.classList.add("hidden")
}

export class Modal {
    static list = {}

    static create(config = {}) {
        if (!config) err("Modal config can't be empty")

        const id = valid(config.id) ?? crypto.randomUUID().replaceAll("-", "")

        if (Modal.list[id]) {
            const existingModal = Modal.list[id]

            if (valid(config.content)) {
                existingModal.setContent(config.content)
            }

            if (valid(config.title)) {
                existingModal.setTitle(config.title)
            }

            return existingModal
        }

        const name = valid(config.name) ?? "Untitled"
        const isHiddenOnSpawn = valid(config.show) ?? true
        const modalClassList = validArray(config.modalClassList) ?? []
        const title = valid(config.title) ?? false
        const pages = valid(config.pages) ?? {}
        const content = valid(config.content) ?? {}
        const size = valid(config.size) ?? "default"

        const modalBase = renderModalBase({
            id: id,
            isHiddenOnSpawn: isHiddenOnSpawn,
            modalClassList: modalClassList,
            title: title,
            pages: pages,
            content: content,
            size: size
        })

        function isSidebar() {
            return modalBase.body.classList.contains("modal-body-sidebar")
        }

        document.body.prepend(modalBase.wrapper)

        const api = {
            id: id,

            el: modalBase.wrapper,

            bind: (el) => {
                function bindClick(el) {
                    el.addEventListener("click", () => {
                        modalBase.wrapper.classList.remove("hidden")
                        showBackdrop()
                    })
                }

                if (el instanceof NodeList) {
                    el.forEach(e => {
                        bindClick(e)
                    })
                }
                else if (el instanceof HTMLElement) {
                    bindClick(el)
                }
            },

            zIndex(value) {
                if(Number.isInteger(value)) {
                    modalBase.wrapper.style.zIndex = value
                }
            },

            open: () => {
                modalBase.wrapper.classList.remove("hidden")
                showBackdrop()
            },

            close: () => {
                hideBackdrop()
                modalBase.wrapper.classList.add("hidden")
            },

            destroy: () => {
                modalBase.wrapper.remove()
                delete Modal.list[id]
            },

            isSidebar: isSidebar,

            disableCurrent() {
                if (isSidebar()) {
                    const body = modalBase.body
                    const pages = body.querySelectorAll(".modal-body__sidebar-content")

                    pages.forEach(p => {
                        if(!p.classList.contains("hidden")) p.classList.add("disabled")
                    })
                }
            },
            unDisableCurrent() {
                if (isSidebar()) {
                    const body = modalBase.body
                    const pages = body.querySelectorAll(".modal-body__sidebar-content")

                    pages.forEach(p => {
                        if(!p.classList.contains("hidden")) p.classList.remove("disabled")
                    })
                }
            },

            pageShow: (id) => {
                if (isSidebar()) {
                    const body = modalBase.body
                    const wrapper = modalBase.wrapper
                    const pages = body.querySelectorAll(".modal-body__sidebar-content")

                    pages.forEach((page, index) => {
                        const pageid = page.id.split("_content")[0]

                        if (index == id) {
                            pages.forEach(p => p.classList.add("hidden"))
                            page.classList.remove("hidden")

                            const pageSidebarBtn = wrapper.querySelector(`[id="${pageid}"]`)

                            if (pageSidebarBtn) {
                                wrapper.querySelectorAll(".modal-sidebar__item")
                                    .forEach(i => i.classList.remove("active"))

                                pageSidebarBtn.classList.add("active")
                            }
                        }
                    })
                }
            },

            clear: () => {
                const body = modalBase.body

                body.querySelectorAll("input").forEach(i => {
                    i.value = ''

                    i.dispatchEvent(new Event("input", {
                        bubbles: true
                    }))
                })
            },

            setContent: (content) => {
                const contentEl = modalBase.wrapper.querySelector(".modal-content")

                if (!contentEl) return

                if (typeof content === "string") {
                    contentEl.innerHTML = content
                }
                else if (content instanceof HTMLElement) {
                    contentEl.innerHTML = ''
                    contentEl.appendChild(content)
                }
            },

            setTitle: (newTitle) => {
                const titleEl = modalBase.wrapper.querySelector(".modal-title")

                if (!titleEl) return

                titleEl.textContent = newTitle
            }
        }

        Modal.list[id] = api

        return api
    }

    static get(id) {
        return Modal.list[id] ?? null
    }

    static destroy(id) {
        const modal = Modal.list[id]

        if (!modal) return

        modal.destroy()
    }

    static closeAll() {
        Object.values(Modal.list).forEach(modal => {
            modal.close()
        })
    }
}