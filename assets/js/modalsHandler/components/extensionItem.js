import { generateAvatar, changeTagName } from "../../lib.js"
import { valid } from "../engine.js"

export function renderExtensionItem(properties = {}) {
    const title = properties.title
    const subtitle = properties.subtitle
    const description = properties.description
    const image = properties.image
    const tags = properties.tags
    const buttons = properties.buttons

    const wrapper = document.createElement("div")
    wrapper.classList.add("modal-extension__item")

    let imageEl = document.createElement("div")

    if (!image) {
        imageEl.innerHTML = generateAvatar(title)
        imageEl = imageEl.firstElementChild
    }
    else if (typeof image == "string" && /^[A-Za-z]:\//.test(image)) {
        imageEl = document.createElement("img")
        imageEl.src = image
    }
    else if (typeof image == "string") {
        imageEl.innerHTML = generateAvatar(image)
        imageEl = imageEl.firstElementChild
    }
    else {
        imageEl = document.createElement("img")
        imageEl.src = image
    }

    const contentEl = document.createElement("div")
    contentEl.classList.add("modal-extension__item-content")

    const contentTitleEl = document.createElement("div")
    contentTitleEl.classList.add("modal-extension__item-title")
    contentTitleEl.textContent = title

    const contentSubtitleEl = document.createElement("div")
    contentSubtitleEl.classList.add("modal-extension__item-subtitle")
    contentSubtitleEl.textContent = subtitle

    const contentDescEl = document.createElement("div")
    contentDescEl.classList.add("modal-extension__item-desc")
    contentDescEl.textContent = description

    const tagWrapper = document.createElement("div")
    tagWrapper.classList.add("modal-extension__item-tag__wrapper")

    if (tags && Array.isArray(tags)) {
        tags.forEach(t => {
            const name = valid(t.name) ?? "Unnamed"
            const type = valid(t.type) ?? "No tag"

            const types = ["module", "permission"]

            const tag = document.createElement("div")
            tag.classList.add("modal-extension__item-tag")

            const tagName = document.createElement("div")
            tagName.classList.add("modal-extension__item-tag__name")
            tagName.textContent = name

            if (types.includes(type)) tag.classList.add(type)

            tag.appendChild(tagName)

            tagWrapper.appendChild(tag)
        })
    }

    const btnWrapper = document.createElement("div")
    btnWrapper.classList.add("modal-extension__item-btn__wrapper")

    if (buttons && Array.isArray(buttons)) {
        buttons.forEach(btn => {
            const icon = valid(btn.icon) ?? "close"
            const callback = valid(btn.onclick) ?? false

            const btnEl = document.createElement("button")
            btnEl.classList.add("modal-extension__item-btn")
            
            const btnIconEl = document.createElement("span")
            btnIconEl.classList.add("material-symbols-rounded")
            btnIconEl.textContent = icon

            btnEl.appendChild(btnIconEl)

            btnEl.addEventListener("click", () => {
                callback(
                    {
                        element: wrapper
                    }
                )
            })

            btnWrapper.appendChild(btnEl)
        })
    }

    contentEl.appendChild(contentTitleEl)
    if (subtitle) contentEl.appendChild(contentSubtitleEl)
    contentEl.appendChild(contentDescEl)
    contentEl.appendChild(tagWrapper)
    contentEl.appendChild(btnWrapper)

    wrapper.appendChild(imageEl)
    wrapper.appendChild(contentEl)

    return wrapper
}