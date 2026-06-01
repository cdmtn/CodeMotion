import { createDIV, createIcon, createSpan } from "../handlers/helpers.js"

export function renderCentered(properties = {}) {
    const icon = properties.icon
    
    const wrapper = createDIV()
    wrapper.classList.add("modal-centered")

    if(icon) {
        const iconEl = createIcon(icon)
        wrapper.appendChild(iconEl)
    }

    return wrapper
}