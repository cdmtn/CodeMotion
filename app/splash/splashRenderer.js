import { GLS } from "../../assets/js/lib.js"

document.addEventListener("DOMContentLoaded", async () => {
    const gls = await GLS.init()

    const buttons = document.querySelector(".buttons")
    const closeBtn = buttons.querySelector("#close")
    const offlineBtn = buttons.querySelector("#offline")

    let packageData = await window.electron.getPackageData()
    let version = packageData.version
    let author = packageData.author
    let desc = packageData.description

    let image = document.querySelector(".image")
    let r = Math.floor(Math.random() * 12) + 1;
    let randomImage = `../assets/media/splash/splash_${r}.svg`
    let splashImage = new Image()
    splashImage.src = randomImage
    splashImage.decoding = "async"
    image.replaceChildren(splashImage)

    document.querySelector(".version").innerText = `v${version}`
    document.querySelector(".author").innerText = gls.get("splash.createdBy", { name: author })
    document.querySelector(".description").innerText = gls.get("splash.description")

    window.electron.onStatusUpdate((_event, data) => {
        document.querySelector(".status").innerText = data.msg

        if (data.error) {
            document.querySelector(".status").classList.add("text-danger")
            document.querySelector(".ring-loader").classList.add("hidden")

            let buttons = document.querySelector(".buttons")
            buttons.classList.remove("hidden")
        }
    });

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