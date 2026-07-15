import { createDIV } from "../handlers/helpers.js"

export function renderButton(properties = {}) {
    const classes = ["default", "danger"]
    const id = properties.id
    const title = properties.title
    const container = properties.container
    const element = properties.element
    const btnClass = properties.class
    const onclick = properties.onclick

    const button = document.createElement("button")
    button.id = id
    button.classList.add("modal-button")
    button.textContent = title

    if(classes.includes(btnClass)) button.classList.add(btnClass)

    if(!title) button.textContent = id

    if(onclick && typeof onclick === "function") {
        button.addEventListener("click", onclick)
    }

    if(!container) {
        return button
    }
    else {
        const containerEl = element.querySelector(container)

        if(containerEl) {
            containerEl.classList.add("modal-buttons")
            containerEl.appendChild(button)

            return containerEl
        }
    }
}