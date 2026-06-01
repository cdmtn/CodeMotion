import { createDIV, createSpan } from "../handlers/helpers.js"

export function renderDivider() {
    const wrapper = createDIV()
    wrapper.classList.add("modal-divider")

    return wrapper
}