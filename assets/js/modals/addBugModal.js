import { Modal } from "../modalsHandler/engine.js"
import { addToBug, createNotify, escapeHtml } from "../lib.js"
import { GLS } from "../lib.js"

export async function getAddBugModal() {
    const gls = await GLS.init()

    function lgls(string) {
        return gls.get(`modals.addBug.${string}`)
    }

    const addBugModal = Modal.create({
        id: "addBug",
        name: "addBug",
        modalClassList: ["window"],
        size: "sm",
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
                        type: "input",
                        placeholder: lgls("inputs.name"),
                        id: "addBugName",
                    },
                    {
                        type: "input",
                        placeholder: lgls("inputs.description"),
                        id: "addBugContent",
                    },
                    {
                        type: "switch",
                        id: "isLocal",
                        checked: true,
                        disabled: true,
                        title: lgls("localBugSwitch.title"),
                        description: lgls("localBugSwitch.description")
                    },
                    {
                        type: "container",
                        id: "buttonsContainer"
                    },
                    {
                        type: "button",
                        id: "addBugConfirm",
                        title: lgls("confirmBtnLocal"),
                        container: "#buttonsContainer"
                    }
                ]
            },
        ]
    })
    
    const element = addBugModal.el
    const addBtn = element.querySelector("#addBugConfirm")

    element.querySelector("#isLocal").addEventListener("change", (event) => {
        const checked = event.target.checked

        addBtn.textContent = checked ? lgls("confirmBtnLocal") : lgls("confirmBtn")
    })

    addBtn.addEventListener("click", async () => {
        const bugName = escapeHtml(element.querySelector("#addBugName").value)
        const bugContent = escapeHtml(element.querySelector("#addBugContent").value)

        if(bugContent.length > 0 && bugContent.length > 0) {
            const alreadyExistingBugs = addToBug(
                {
                    priority: 0,
                    value: bugName,
                    desc: bugContent,
                    isSelf: true,
                    org: false
                }
            )
            const bugAddingRes = await window.electron.modifyLocalBugs(
                {
                    type: "add",
                    data: {
                        id: Object.keys(alreadyExistingBugs).length,
                        priority: 0,
                        value: bugName,
                        description: bugContent,
                        self: true,
                        time: Math.floor(Date.now() / 1000),
                        resolved: 0
                    }
                }
            )

            
            if(bugAddingRes.success == true) {
                addBugModal.close()

                if (bugAddingRes.success) {
                    bugsObject[bugAddingRes.data.id] = bugAddingRes.data
                }

                if(document.querySelector(".sidebar-item#bugs")) {
                    document.querySelector(".sidebar-item#bugs").click()
                }
            }
            else {
                createNotify(
                    {
                        icon: "close",
                        title: "Error while bug adding",
                        content: bugAddingRes.error
                    }
                )  
            }
        }
        else {
            createNotify(
                {
                    icon: "close",
                    title: "Error while bug adding",
                    content: "All fields must be filled"
                }
            )
        }
    })

    return addBugModal
}