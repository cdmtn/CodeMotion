import { GLS } from "../../assets/js/lib.js"

document.addEventListener("DOMContentLoaded", async () => {
    const gls = await GLS.init()

    const buttons = document.querySelector(".buttons")
    const closeBtn = buttons.querySelector("#close")
    const offlineBtn = buttons.querySelector("#offline")

    let packageData = await window.electron.getPackageData()
    let version = packageData.version

    let image = document.querySelector(".image")
    let r = Math.floor(Math.random() * 12) + 1
    let randomImage = `../assets/media/splash/splash_${r}.png`
    let splashImage = new Image()
    splashImage.src = randomImage
    splashImage.decoding = "async"
    image.replaceChildren(splashImage)

    document.querySelector<HTMLElement>(".version").innerText = `v${version}`
    document.querySelector<HTMLElement>(".description").innerText = gls.get("splash.description")

    window.electron.onStatusUpdate((_event: unknown, data: any) => {
        document.querySelector<HTMLElement>(".status").innerText = data.msg

        if (data.error) {
            document.querySelector(".status").classList.add("text-danger")
            document.querySelector(".ring-loader").classList.add("hidden")

            let buttons = document.querySelector(".buttons")
            buttons.classList.remove("hidden")
        }
    })

    closeBtn.textContent = gls.get("splash.closeBtn")
    offlineBtn.textContent = gls.get("splash.offlineBtn")

    closeBtn.addEventListener("click", () => {
        window.electron.close()
    })
    offlineBtn.addEventListener("click", async () => {
        await window.electron.setNonAccountMode(true)
        window.electron.reload()
    })
})
