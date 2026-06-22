import { generateAvatar, truncateString } from "../../assets/js/lib.js"

window.electron.onData(data => {
    const types = ["default", "danger", "success", "warn"]

    const icon = data.icon == undefined ? false : data.icon
    const image = data.image == undefined ? false : data.image
    const initials = data.initials == undefined ? false : data.initials
    const title = data.title == undefined ? "Unnamed" : data.title
    const type = data.type == undefined ? "default" : data.type
    const description = data.description == undefined ? "No description provided" : data.description

    const notifyWrapper = document.querySelector(".notification-wrapper")
    const notifyIcon = document.querySelector(".notification-icon span")
    const notifyTitle = document.querySelector(".notification-title")
    const notifyDescription = document.querySelector(".notification-description")
    const notifyClose = document.querySelector(".notification-close")

    if(!icon) {
        if(image && /^https?:\/\//.test(String(image))) {
            const img = document.createElement("img")
            img.classList.add("notification-image")
            img.src = image

            notifyIcon.parentElement.appendChild(img)
            notifyIcon.remove()
        }
        else if(initials) {
            const generatedAvatar = generateAvatar(initials)

            notifyIcon.parentElement.classList.add("initials")
            notifyIcon.parentElement.innerHTML = generatedAvatar
        }
        else {
            notifyIcon.parentElement.remove()
        } 
    }
    else {
        notifyIcon.textContent = icon
    }

    if(types.includes(type)) notifyWrapper.classList.add(type)
        
    notifyClose.addEventListener("click", () => {
        window.electron.close()
    })

    notifyTitle.textContent = truncateString(title, 80)
    notifyDescription.textContent = truncateString(description, 250)
})