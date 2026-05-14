import { Setting } from "../settings.js"

export function optionsThemeButtonHandler(themeSelect) {
    themeSelect.on("click", (item) => {
        const id = item.id;

        document.querySelector("#themeSwitchTransition")?.remove()

        const tempStyle = document.createElement("style")
        tempStyle.id = "themeSwitchTransition"
        tempStyle.innerHTML = `* { transition: .2s!important; }`
        document.head.appendChild(tempStyle)

        setTimeout(() => { tempStyle.remove() }, 120)

        Setting.themeSelect(id)
    })
}