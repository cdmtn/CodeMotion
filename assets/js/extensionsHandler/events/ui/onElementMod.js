export function getEl(id) {
    const wrapper = document.querySelector(`.extension-elements__wrapper`)

    return wrapper.querySelector(`[id="${id}"]`)
}
function sendToElement(id, type, data) {
    window.electron.ext.ui.element.sendTo(
        {
            id: id,
            type: type,
            data: data
        }
    )
}

export function onElementMod(data, modules = {}) {
    const id = data.id
    const type = data.type
    const context = data.extName
    const value = data.value

    const topbarElementInstance = modules.TopBarElement
    const idify = modules.idify

    const el = getEl(id)

    if(type == "setSrc" && el instanceof HTMLImageElement) {
        el.src = value
    }
    if(type == "onEvent" && el instanceof HTMLImageElement) {
        const events = {
            "hover": "mouseenter",
            "unhover": "mouseleave",
            "click": "click",
            "mouseenter": "mouseenter",
            "mouseleave": "mouseleave"
        }

        if(value in events) {
            el.addEventListener(events[value], () => {
                sendToElement(id, "onEventTriggered", { eventName: events[value] })
            })
        }
    }
    if(type == "setPosition" && el instanceof HTMLImageElement) {
        const availablePositions = value.availablePositions
        const positions = value.positions

        let styles = []

        Object.keys(positions).forEach(name => {
            styles.push(
                availablePositions[name].replaceAll("{v}", positions[name])
            )
        })

        el.style.cssText += styles.join(";")
    }
    if(type == "setSize" && el instanceof HTMLImageElement) {
        const availableSizes = value.availableSizes
        const sizes = value.sizes

        let styles = []

        Object.keys(sizes).forEach(name => {
            styles.push(
                availableSizes[name].replaceAll("{v}", sizes[name])
            )
        })

        el.style.cssText += styles.join(";")
    }
    if(type == "setTopbarItemSetup") {
        const topbarItem = new topbarElementInstance(id)
        const item = topbarItem.item

        if("colors" in value) {
            if("background" in value.colors) item.style.background = value.colors.background
            if("text" in value.colors) item.style.color = value.colors.text
        }

        topbarItem.content(value)
        topbarItem.show()
    }
    if(type == "setTopbarItemHide") {
        const idifiedID = idify(id)

        if (topbarElementInstance.instances.has(idifiedID)) {
            const topbarItem = topbarElementInstance.instances.get(idifiedID)

            requestAnimationFrame(() => {
                topbarItem.hide()
            })
        }
    }
    if(type == "setTopbarItemHideWithIcon") {
        const idifiedID = idify(id)

        if (topbarElementInstance.instances.has(idifiedID)) {
            const topbarItem = topbarElementInstance.instances.get(idifiedID)

            requestAnimationFrame(() => {
                topbarItem.hide({ iconVisible: true })
            })
        }
    }
    if(type == "setTopbarItemShow") {
        const idifiedID = idify(id)

        if (topbarElementInstance.instances.has(idifiedID)) {
            const topbarItem = topbarElementInstance.instances.get(idifiedID)

            requestAnimationFrame(() => {
                topbarItem.show()
            })
        }
    }
    if(type == "setTopbarItemEvent") {
        const idifiedID = idify(id)

        if (topbarElementInstance.instances.has(idifiedID)) {
            const topbarItem = topbarElementInstance.instances.get(idifiedID)

            if(value == "click") {
                topbarItem.item.classList.add("topbar-item__clickable")
            }

            requestAnimationFrame(() => {
                topbarItem.on(value, () => {
                    sendToElement(id, "onEventTriggered", { eventName: value })
                })
            })
        }
    }
}