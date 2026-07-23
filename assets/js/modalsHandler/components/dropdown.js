import { _Options } from "../../libClasses/options.js"

export function renderDropdown(properties = {}) {
    const id = properties.id
    const title = properties.title
    const description = properties.description
    const options = properties.options || []
    const selected = properties.selected || ""

    const wrapper = document.createElement("div")
    wrapper.classList.add("modal-category__item")

    const elementTitle = document.createElement("div")
    elementTitle.classList.add("modal-category__item-title")
    elementTitle.textContent = title

    const elementDesc = document.createElement("div")
    elementDesc.classList.add("modal-category__item-desc")
    elementDesc.textContent = description

    const select = new _Options(id)

    options.forEach(opt => {
        const value = typeof opt === "string" ? opt : opt.value
        const label = typeof opt === "string" ? opt : (opt.label || opt.value)
        const item = select.add(value, label)
        if (value === selected) item.default()
    })

    if (title) wrapper.appendChild(elementTitle)
    if (description) wrapper.appendChild(elementDesc)
    wrapper.appendChild(select.el)

    return wrapper
}
