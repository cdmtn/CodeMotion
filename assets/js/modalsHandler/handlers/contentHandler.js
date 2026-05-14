import { valid, validArray, validHTTPS, validBool } from "../engine.js"

import { renderSwitch } from "../components/switch.js"
import { renderRange } from "../components/range.js"
import { renderPlaceholder } from "../components/placeholder.js"
import { renderExtensionItem } from "../components/extensionItem.js"
import { renderOrganization } from "../components/organization.js"

const types = {
    columns: (wrapper, data) => {
        const cols = valid(data.cols) ?? 0
        const gap = valid(data.gap) ?? 0

        wrapper.classList.add("modal-columns")

        if (cols != 0) {
            wrapper.style.cssText += `display: grid;grid-template-columns: repeat(${cols}, 1fr)`
        }
        if (gap != 0) {
            wrapper.style.cssText += `gap: ${gap}px`
        }

        return wrapper
    },
    row: (wrapper, data) => {
        const classList = validArray(data.classList) ?? []

        if (classList != 0) {
            wrapper.classList.add("modal-row", ...classList)
        }

        return wrapper
    }
}

export function sideBarContentHandler(element, contentData, id) {
    const contentWrapper = document.createElement("div")
    contentWrapper.id = `${id}_content`
    contentWrapper.classList.add("modal-body__sidebar-content", "hidden")

    contentData.forEach(contentElement => {
        const type = valid(contentElement.type) ?? false

        if (type != false) {
            if (type in types) {
                const wrapper = types[type](contentWrapper, contentElement)
                const items = valid(contentElement.items) ?? {}

                element.appendChild(wrapper)

                contentItemsHandler(wrapper, items)
            }
        }
    })
}

export function defaultContentHandler(element, contentData) {
    const contentWrapper = document.createElement("div")
    contentWrapper.classList.add("modal-body__content")

    if(!Array.isArray(contentData)) return

    contentData.forEach(contentElement => {
        const type = valid(contentElement.type) ?? false

        if (type != false) {
            if (type in types) {
                const wrapper = types[type](contentWrapper, contentElement)
                const items = valid(contentElement.items) ?? {}

                element.appendChild(wrapper)

                contentItemsHandler(wrapper, items)
            }
        }
    })
}

function contentItemsHandler(element, itemsData) {
    if(!Array.isArray(itemsData)) return

    itemsData.forEach(item => {
        const type = valid(item.type) ?? false
        let note = false
        let disabled = false

        if ("note" in item) {
            note = document.createElement("div")
            note.classList.add("modal-note")
            note.textContent = item.note
        }
        if("disabled" in item) disabled = item.disabled

        if (type == "switch") {
            const id = valid(item.id) ?? false
            const title = valid(item.title) ?? "Unnamed"
            const desc = valid(item.description) ?? "No description provided"

            const switchElement = renderSwitch(
                {
                    id: id,
                    title: title,
                    description: desc
                }
            )

            element.appendChild(switchElement)

            if (note) switchElement.appendChild(note)
            if (disabled) switchElement.classList.add("disabled")
        }
        if (type == "range") {
            const id = valid(item.id) ?? false
            const title = valid(item.title) ?? "Unnamed"
            const desc = valid(item.description) ?? "No description provided"
            const min = valid(item.min) ?? 0
            const max = valid(item.max) ?? 100
            const value = valid(item.value) ?? 0
            const step = valid(item.step) ?? 1
            const prefix = valid(item.prefix) ?? ""

            const rangeElement = renderRange(
                {
                    id: id,
                    title: title,
                    description: desc,
                    min: min,
                    max: max,
                    value: value,
                    step: step,
                    prefix: prefix
                }
            )

            element.appendChild(rangeElement)

            if (note) rangeElement.appendChild(note)
            if (disabled) rangeElement.classList.add("disabled")
        }
        if (type == "placeholder") {
            const id = valid(item.id) ?? false
            const title = valid(item.title) ?? false
            const description = valid(item.description) ?? false

            const placeholderElement = renderPlaceholder(
                {
                    id: id,
                    title: title,
                    description: description
                }
            )

            element.appendChild(placeholderElement)

            if (note) placeholderElement.appendChild(note)
            if (disabled) placeholderElement.classList.add("disabled")
        }
        if (type == "extensionItem") {
            const title = valid(item.title) ?? false
            const subtitle = valid(item.subtitle) ?? false
            const description = valid(item.description) ?? false
            const image = valid(item.image) ?? false
            const tags = validArray(item.tags) ?? []
            const buttons = validArray(item.buttons) ?? []

            const extensionItemElement = renderExtensionItem(
                {
                    title: title,
                    subtitle: subtitle,
                    description: description,
                    image: image,
                    tags: tags,
                    buttons: buttons
                }
            )

            element.appendChild(extensionItemElement)

            if (note) extensionItemElement.appendChild(note)
            if (disabled) extensionItemElement.classList.add("disabled")
        }
        if (type == "organization") {
            const name = valid(item.name) ?? "Unnamed"
            const description = valid(item.description) ?? "No description provided"
            const website = validHTTPS(item.website) ?? false
            const columns = validArray(item.columns) ?? []
            const badgeOwner = validBool(item.badgeOwner) ?? false
            const badgeVerified = validBool(item.badgeVerified) ?? false

            const organizationElement = renderOrganization(
                {
                    name: name,
                    description: description,
                    website: website,
                    columns: columns,
                    badgeOwner: badgeOwner,
                    badgeVerified: badgeVerified
                }
            )

            element.appendChild(organizationElement)

            if (note) organizationElement.appendChild(note)
            if (disabled) organizationElement.classList.add("disabled")
        }
    })
}