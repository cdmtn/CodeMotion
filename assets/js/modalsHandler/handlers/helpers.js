export function createDIV() {
    return document.createElement("div")
}
export function createParagraph(text, isWrapper = false) {
    const p = document.createElement("p")
    p.textContent = text

    if(isWrapper) {
        const wrapper = document.createElement("span")
        wrapper.appendChild(p)

        return wrapper
    }
    else {
        return p
    }
}
export function createIcon(name) {
    const icon = document.createElement("span")
    icon.classList.add("material-symbols-rounded")
    icon.textContent = name

    return icon
}
export function createLink(url) {
    const link = document.createElement("a")
    link.target = "_blank"
    link.href = `http://safety.yurba.one/?t=link&source=${url}`

    return link
}
export function createBadge(icon) {
    const badge = document.createElement("div")
    badge.classList.add("modal-badge")

    const iconEl = document.createElement("span")
    iconEl.classList.add("material-symbols-rounded")
    iconEl.textContent = icon

    badge.appendChild(iconEl)

    return badge
}
export function createSpan() {
    return document.createElement("span")
}