import { Modal } from "../modalsHandler/engine.js"
import { GLS } from "../lib.js"

export async function getLogoutModal() {
    const gls = await GLS.init()

    function lgls(string) {
        return gls.get(`modals.logout.${string}`)
    }

    const logoutModal = Modal.create({
        id: "logoutModal",
        name: "logoutModal",
        modalClassList: ["window"],
        size: "mini",
        title: lgls("title"),

        content: [
            {
                type: "row",
                gap: 15,
                classList: ['background'],
                items: [
                    {
                        type: "placeholder",
                        title: lgls("header.title"),
                        description: lgls("header.description")
                    },
                    {
                        type: "container",
                        id: "buttonsContainer"
                    },
                    {
                        type: "button",
                        id: "logoutConfirm",
                        title: lgls("buttonConfirm"),
                        container: "#buttonsContainer"
                    },
                    {
                        type: "button",
                        id: "logoutCancel",
                        title: gls.get("cancel"),
                        container: "#buttonsContainer",
                        class: "danger"
                    }
                ]
            },
        ]
    })

    console.log(logoutModal)

    const cancelBtn = logoutModal.el.querySelector("#logoutCancel")
    const confirmBtn = logoutModal.el.querySelector("#logoutConfirm")
    
    cancelBtn.addEventListener("click", () => {
        logoutModal.close()
    })

    confirmBtn.addEventListener("click", async () => {
        await window.electron.logout()
        await window.electron.reload()
    })

    return logoutModal
}