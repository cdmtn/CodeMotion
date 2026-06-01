import { idify } from "../../lib.js"
import { valid, validBool } from "../engine.js"
import { sideBarContentHandler } from "./contentHandler.js"

export function sideBarHandler(pagesArray = [], properties = {}) {
    const body = properties.body
    const title = properties.title

    const createSidebarItem = () => {
        const item = document.createElement("div")
        item.classList.add("modal-sidebar__item")
        return item
    }

    body.classList.add("modal-body-sidebar")

    const sidebar = document.createElement("div")
    sidebar.classList.add("modal-sidebar")

    // setup sidebar title
    if(title) {
        const sidebarTitle = createSidebarItem()
        sidebarTitle.textContent = title
        sidebarTitle.classList.add("title")

        sidebar.appendChild(sidebarTitle)
    }

    body.appendChild(sidebar)

    // adding .modal-sidebar__item to sidebar
    for (let i = 0; i < pagesArray.length; i++) {
        const p = pagesArray[i]

        const name = valid(p.name) ?? "Unnamed"
        const icon = valid(p.icon) ?? false
        const content = valid(p.content) ?? false
        const label = valid(p.label) ?? false
        const isDivider = validBool(p.divider) ?? false
        const id = idify(name)

        const item = createSidebarItem()
        if(!isDivider) item.textContent = name
        item.id = id

        if(icon) {
            const itemIcon = document.createElement("span")
            itemIcon.classList.add("material-symbols-rounded")
            itemIcon.textContent = icon

            item.prepend(itemIcon)
        }

        if(isDivider) {
            item.classList.add("sidebar-divider")
        }

        if(label) {
            const labelEl = document.createElement("span")
            labelEl.classList.add("modal-sidebar__item-label")
            labelEl.textContent = label

            item.appendChild(labelEl)
        }

        // adding click action (show sidebar page)
        item.addEventListener("click", (e) => {
            const thisPageID = e.currentTarget.id

            const allPages = body.querySelectorAll(".modal-body__sidebar-content")
            const thisPage = body.querySelector(`.modal-body__sidebar-content[id="${thisPageID}_content"]`)

            allPages.forEach(e => { e.classList.add("hidden") })
            thisPage.classList.remove("hidden")

            body.querySelectorAll(".modal-sidebar__item").forEach(e => { e.classList.remove("active") })
            e.currentTarget.classList.add("active")
        })

        // auto click on first child
        requestAnimationFrame(() => {
            if(i == 0) {
                item.click()
            }
        })

        sidebar.appendChild(item)

        sideBarContentHandler(body, content, id)
    }
}