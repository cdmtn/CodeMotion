import { idify } from "../lib.js";

function addPopover(el, gls) {
    if (el.hasAttribute("noPopover")) return
    if (el._hasPopover) return

    const tooltip = document.createElement("div")
    tooltip.role = "tooltip"
    tooltip.id = idify(el.id)

    if(typeof gls != "object") {
        tooltip.textContent = el.getAttribute("tooltip")
    }
    else {
        tooltip.textContent = gls.get(el.getAttribute("tooltip"))
    }

    tooltip.className = "tooltip"
    tooltip.style.zIndex = "9999"

    const tooltipPosition = el.getAttribute("tooltippos") ? el.getAttribute("tooltippos") : "right"
    let tooptipOffset

    switch (tooltipPosition) {
        case "right":
            tooptipOffset = [0, -10]
            break;
        case "top":
            tooptipOffset = [0, 0]
            break;
    }

    el.appendChild(tooltip)

    const popperInstance = Popper.createPopper(el, tooltip, {
        placement: tooltipPosition,
        modifiers: [
            {
                name: 'offset',
                options: {
                    offset: tooptipOffset,
                },
            },
        ],
    })

    function show() {
        tooltip.setAttribute("data-show", "")
        popperInstance.update()
    }

    function hide() {
        tooltip.removeAttribute("data-show")
    }

    const showEvents = ["mouseenter", "focus"]
    const hideEvents = ["mouseleave", "blur"]

    showEvents.forEach((event) => el.addEventListener(event, show))
    hideEvents.forEach((event) => el.addEventListener(event, hide))

    el._hasPopover = true
}

export function handlePopovers(gls) {
    document.querySelectorAll("[tooltip]").forEach(e => {
        addPopover(e, gls)
    })

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {

                if (node.nodeType !== 1) return
                if (node.matches?.("[tooltip]")) {
                    addPopover(node, gls)
                }

                node.querySelectorAll?.("[tooltip]").forEach(addPopover)
            })
        })
    })

    observer.observe(document.body, {
        childList: true,
        subtree: true
    })
}