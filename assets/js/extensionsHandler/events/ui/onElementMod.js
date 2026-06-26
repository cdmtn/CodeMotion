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

export function onElementMod(data) {
    const id = data.id
    const type = data.type
    const context = data.extName
    const value = data.value

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
}