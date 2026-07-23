import { createDIV, createSpan } from "../handlers/helpers.js"

export function renderImage(properties = {}) {
    const id = properties.id
    const src = properties.src

    const wrapper = document.createElement("img")
    wrapper.classList.add("modal-image")
    wrapper.id = id
    wrapper.src = ""

    if(src) {
        wrapper.src = src
    }

    return wrapper
}