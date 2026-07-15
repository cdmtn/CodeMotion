import { createDIV } from "../handlers/helpers.js"

export function renderContainer(properties = {}) {
    const id = properties.id
    const classList = properties.classList
    const html = properties.html

    const container = createDIV()
    container.id = id
    container.classList.add("modal-container")

    if(Array.isArray(classList)) {
        container.classList.add(...classList)
    }

    if(html) {
        container.innerHTML = html
    }

    return container
}