import { generateAvatar, idify, truncateString } from "../../lib.js"
import { valid } from "../engine.js"
import { createDIV, createParagraph, createIcon, createLink, createBadge } from "../handlers/helpers.js"

export function renderOrganization(properties = {}) {
    let id = properties.id
    const name = properties.name
    const description = properties.description
    const website = properties.website
    const columns = properties.columns
    const badgeOwner = properties.badgeOwner
    const badgeVerified = properties.badgeVerified

    function createSection() {
        const sectionEl = createDIV()
        sectionEl.classList.add("modal-org__section")

        return sectionEl
    }
    function createCounter() {
        const counterItemEl = createDIV()
        counterItemEl.classList.add("modal-org__section-counter")

        return counterItemEl
    }
    function createSectionComponent() {
        const sectionEl = createDIV()
        sectionEl.classList.add("modal-org__section-component")

        return sectionEl
    }

    if(!id) {
        id = idify(name)
    }

    const wrapper = document.createElement("div")
    wrapper.classList.add("modal-org")
    wrapper.id = id

    // first section
    const firstSectionEl = createSection()
    firstSectionEl.classList.add("row")
    firstSectionEl.innerHTML = generateAvatar(name)

    const countersEl = createDIV()
    countersEl.classList.add("modal-org__section-counters")

    columns.forEach(col => {
        const name = valid(col.name) ?? "Unnamed"
        const value = valid(col.value) ?? "..."

        const itemEl = createCounter()
        
        const itemTitleEl = createParagraph(name)
        itemTitleEl.classList.add("title")

        const itemValueEl = createParagraph(value)
        itemValueEl.classList.add("value")

        itemEl.appendChild(itemTitleEl)
        itemEl.appendChild(itemValueEl)

        countersEl.appendChild(itemEl)
    })

    firstSectionEl.appendChild(countersEl)

    // second section

    const secondSectionEl = createSection()

    const secondSectionInfoComponent = createSectionComponent()
    
    const secondSectionInfoComponentTitle = createParagraph(name, true)
    secondSectionInfoComponentTitle.classList.add("modal-org__title")

    const secondSectionInfoComponentDesc = createParagraph(truncateString(description, 400))
    secondSectionInfoComponentDesc.classList.add("modal-org-description")

    secondSectionInfoComponent.appendChild(secondSectionInfoComponentTitle)
    secondSectionInfoComponent.appendChild(secondSectionInfoComponentDesc)

    const secondSectionIconTextWrapper = createDIV()
    secondSectionIconTextWrapper.classList.add("modal-org-icontext__wrapper")

    if(badgeVerified) {
        const badge = createBadge("check")
        badge.classList.add("modal-verified__badge")

        secondSectionInfoComponentTitle.appendChild(badge)
    }
    if(badgeOwner) {
        const badge = createBadge("crown")
        badge.classList.add("modal-owner__badge")

        secondSectionInfoComponentTitle.appendChild(badge)
    }

    if(website) {
        let url = new URL(website)
        let urlPreview = url.host

        if (url.pathname != "/") {
            urlPreview += url.pathname
        }

        const secondSectionIconText = createDIV()
        secondSectionIconText.classList.add("modal-org-icontext")

        const secondSectionIconTextIcon = createIcon("link_2")
        const secondSectionIconTextLink = createLink(website)
        secondSectionIconTextLink.textContent = urlPreview

        secondSectionIconText.appendChild(secondSectionIconTextIcon)
        secondSectionIconText.appendChild(secondSectionIconTextLink)

        secondSectionIconTextWrapper.appendChild(secondSectionIconText)

        secondSectionInfoComponent.appendChild(secondSectionIconTextWrapper)
    }

    secondSectionEl.appendChild(secondSectionInfoComponent)

    wrapper.appendChild(firstSectionEl)
    wrapper.appendChild(secondSectionEl)

    return wrapper
}