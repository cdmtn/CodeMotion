import { sendEvent } from "../../bus.js"
import { createNotify, truncateString, Options, formatUnix } from "../../lib.js"
import { Modal } from "../../modalsHandler/engine.js"

export function joinModalObject({ lgls }) {
    return {
        name: lgls("join.title"),
        icon: "group_add",

        content: [
            {
                type: "row-clear",
                gap: 10,
                items: [
                    {
                        type: "placeholder",
                        title: lgls("join.title"),
                        description: lgls("join.description")
                    },
                    {
                        type: "input",
                        placeholder: lgls("join.inputs.inviteCode"),
                        id: "joinOrgInviteCode"
                    },
                    {
                        type: "button",
                        title: lgls("join.buttons.join"),
                        id: "joinOrgBtn"
                    }
                ]
            }
        ]
    }
}

export function joinModalHandle({ element, lgls }) {
    const joinOrgInviteCode = element.querySelector("#joinOrgInviteCode")
    const joinOrgBtn = element.querySelector("#joinOrgBtn")

    joinOrgBtn.addEventListener("click", async () => {
        const value = joinOrgInviteCode.value

        const joinOrgRes = await window.electron.joinOrg(value)

        if(joinOrgRes.success) {
            createNotify(
                {
                    type: "success",
                    icon: "check",
                    title: lgls("join.successNotification.title", { name: joinOrgRes.msg.name }),
                    content: lgls("join.successNotification.description")
                }
            )

            sendEvent("org-joined", { name: joinOrgRes.msg.name })
        }
        else {
            createNotify(
                {
                    type: "danger",
                    icon: "close",
                    title: lgls("join.errorNotification.title"),
                    content: joinOrgRes.msg
                }
            )  
        }
    })
}