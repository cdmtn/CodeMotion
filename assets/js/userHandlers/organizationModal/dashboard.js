import { sendEvent } from "../../bus.js"
import { createNotify, truncateString, Options, formatUnix, GetOrgAvatar } from "../../lib.js"
import { Modal } from "../../modalsHandler/engine.js"

export function dashboardModalObject({ lgls }) {
    return {
        name: lgls("dashboard.title"),
        icon: "analytics",

        content: [
            {
                type: "row-clear",
                gap: 10,
                items: [
                    {
                        type: "placeholder",
                        title: lgls("dashboard.title"),
                        description: lgls("dashboard.description")
                    },
                    {
                        type: "placeholder",
                        id: "dashboardOrgSelect"
                    },

                    {
                        type: "divider"
                    },

                    {
                        type: "image",
                        src: null,
                        styles: {
                            width: "30px",
                            height: "30px",
                            borderRadius: "5px"
                        },
                        id: "dashboardOrgAvatar",
                        classList: ["hidden"]
                    },
                    {
                        type: "placeholder",
                        title: "...",
                        description: "...",
                        id: "dashboardOrgInfo",
                        classList: ["hidden"]
                    },

                    {
                        type: "divider"
                    },

                    {
                        type: "placeholder",
                        title: lgls("dashboard.members.title"),
                        id: "dashboardOrgMembers",
                        description: "--",
                        classList: ["placeholder-bigdata"]
                    },
                    {
                        type: "placeholder",
                        title: lgls("dashboard.inviteCode.title"),
                        id: "dashboardOrgInviteCode",
                        description: "--",
                        note: lgls("dashboard.inviteCode.note"),
                        classList: ["placeholder-bigdata"]
                    },
                    {
                        type: "placeholder",
                        title: lgls("dashboard.createdAt.title"),
                        id: "dashboardOrgCreatedAt",
                        description: "--",
                        classList: ["placeholder-bigdata"]
                    },

                    {
                        type: "divider"
                    },


                    {
                        type: "placeholder",
                        id: "dashboardOrgEditZoneTitle",
                        title: lgls("dashboard.edit.title"),
                        description: lgls("dashboard.edit.description")
                    },
                    {
                        type: "container",
                        id: "dashboardOrgEditZoneButtons",
                        disabled: true
                    },
                    {
                        type: "button",
                        title: lgls("dashboard.edit.resetInviteCode.title"),
                        id: "dashboardOrgEditResetInvite",
                        container: "#dashboardOrgEditZoneButtons"
                    },
                    {
                        type: "button",
                        title: "Upload new avatar",
                        id: "dashboardOrgEditUploadAvatar",
                        container: "#dashboardOrgEditZoneButtons"
                    },


                    {
                        type: "divider"
                    },
                    
                    {
                        type: "switch",
                        id: "dashboardOrgDangerZoneSwitch",
                        title: lgls("dashboard.dangerZone.switch.title"),
                        description: lgls("dashboard.dangerZone.switch.description")
                    },
                    {
                        type: "placeholder",
                        id: "dashboardOrgDangerZoneTitle",
                        title: lgls("dashboard.dangerZone.title"),
                        classList: ["text-danger"],
                        disabled: true
                    },
                    {
                        type: "container",
                        id: "dashboardOrgButtons",
                        disabled: true
                    },
                    {
                        type: "button",
                        class: "danger",
                        title: lgls("dashboard.dangerZone.deleteBtn"),
                        id: "dashboardOrgRemoveBtn",
                        container: "#dashboardOrgButtons"
                    }
                ]
            }
        ]
    }
}

export function dashboardModalHandle({ userOrgs, element, orgModal }) {
    const dashboardOrgSelect = new Options("dashboardOrgSelect")
    dashboardOrgSelect.clear()
    dashboardOrgSelect.add("none", "None").default()

    Object.keys(userOrgs).forEach(index => {
        const org = userOrgs[index]
        const orgItemData = {}

        if (org.verified == 1) {
            orgItemData["badge"] = { color: "#3264a8", icon: "check" }
        }
        if (org.description) {
            orgItemData["secondary"] = truncateString(org.description, 50)
        }

        const item = dashboardOrgSelect.add(org.id, org.name, orgItemData)
    })

    dashboardOrgSelect.appendTo(element.querySelector("#dashboardOrgSelect"))

    const alreadyLoadedDashboardOrgs = new Map()

    const removeBtn = element.querySelector("#dashboardOrgRemoveBtn")
    const buttonsContainer = element.querySelector("#dashboardOrgButtons")
    const membersCount = element.querySelector("#dashboardOrgMembers .modal-category__item-desc")
    const inviteCode = element.querySelector("#dashboardOrgInviteCode .modal-category__item-desc")
    const createdAt = element.querySelector("#dashboardOrgCreatedAt .modal-category__item-desc")

    const infoWrapper = element.querySelector("#dashboardOrgInfo")
    const infoName = infoWrapper.querySelector("#dashboardOrgInfo .modal-category__item-title")
    const infoDesc = infoWrapper.querySelector("#dashboardOrgInfo .modal-category__item-desc")

    const avatar = element.querySelector("#dashboardOrgAvatar")

    const editButtons = element.querySelector("#dashboardOrgEditZoneButtons")
    const editResetInvite = element.querySelector("#dashboardOrgEditResetInvite")
    const editUploadAvatar = element.querySelector("#dashboardOrgEditUploadAvatar")

    const dangerZoneSwitch = element.querySelector("#dashboardOrgDangerZoneSwitch")
    const dangerZoneTitle = element.querySelector("#dashboardOrgDangerZoneTitle")

    let isOrganizationsSelected = false

    function toggleDangerZone(value) {
        if(typeof value == "boolean") {
            if(value) {
                buttonsContainer.classList.remove("disabled")
                dangerZoneTitle.classList.remove("disabled")
            }
            else {
                buttonsContainer.classList.add("disabled")
                dangerZoneTitle.classList.add("disabled")
            }
        }
    }

    dangerZoneSwitch.addEventListener("change", (e) => {
        if(isOrganizationsSelected && e.target.checked) {
            toggleDangerZone(true)
        }
        else {
            toggleDangerZone(false)
        }
    })

    dashboardOrgSelect.on("click", async (e) => {
        async function render(data) {
            const isOwner = data.is_owner

            infoWrapper.classList.remove("hidden")
            infoName.textContent = data.name
            infoDesc.textContent = data.description

            const avatarUrl = await GetOrgAvatar.get(data.avatarID)
            
            if(avatarUrl) {
                avatar.classList.remove("hidden")
                avatar.src = avatarUrl
            }

            membersCount.textContent = data.members_count
            inviteCode.textContent = data.invite_code == false ? "--" : data.invite_code
            createdAt.textContent = formatUnix(data.created_at, "{dd}.{mm}.{yyyy}, {hh}:{ii}")

            if(!isOwner) {
                dangerZoneTitle.classList.add("hidden")
                dangerZoneSwitch.closest(".modal-category__item").classList.add("hidden")
                buttonsContainer.classList.add("hidden")

                editButtons.classList.add("disabled")
            }
            else {
                dangerZoneTitle.classList.remove("hidden")
                dangerZoneSwitch.closest(".modal-category__item").classList.remove("hidden")
                buttonsContainer.classList.remove("hidden")

                editButtons.classList.remove("disabled")

                editUploadAvatar.onclick = async () => {
                    const res = await window.electron.uploadOrgAvatar(data.id)
                    
                    if(res.success) {
                        sendEvent("org-update", {})
                    }
                    else {
                        createNotify(
                            {
                                type: "success",
                                icon: "check",
                                title: "Avatar updating error",
                                content: String(res.msg)
                            }
                        )
                    }
                }
            }

            // remove btn handler
            removeBtn.onclick = async () => {
                orgModal.disableCurrent()

                const removeOrgRes = await window.electron.removeOrg(data.id)

                if (removeOrgRes.success) {
                    sendEvent("org-removed", {})
                }
                else {
                    createNotify(
                        {
                            type: "danger",
                            icon: "close",
                            title: "Organization delete error",
                            content: String(removeOrgRes.msg)
                        }
                    )
                }

                orgModal.unDisableCurrent()
            }
            // 
            // resend code btn handler
            editResetInvite.onclick = async () => {
                orgModal.disableCurrent()

                const resetOrgInviteCodeRes = await window.electron.resetOrgInviteCode(data.id)

                if (resetOrgInviteCodeRes.success) {
                    const code = resetOrgInviteCodeRes.msg.invite_code
                    inviteCode.textContent = code

                    editButtons.classList.add("disabled")

                    setTimeout(() => {
                       editButtons.classList.remove("disabled")
                    }, 300000)
                }
                else {
                    createNotify(
                        {
                            type: "danger",
                            icon: "close",
                            title: "Organization invite code reset error",
                            content: String(resetOrgInviteCodeRes.msg)
                        }
                    )
                }

                orgModal.unDisableCurrent()
            }
        }

        isOrganizationsSelected = true

        if(e.id == "none") {
            toggleDangerZone(false)
            isOrganizationsSelected = false
        }
        else if(e.id != "none" && dangerZoneSwitch.checked) {
            toggleDangerZone(true)
        }

        if (!alreadyLoadedDashboardOrgs.has(e.id)) {
            const orgRes = await window.electron.getOrgDataFromAPI(e.id)

            if (orgRes.success) {
                const data = orgRes.msg
                await render(data)
                alreadyLoadedDashboardOrgs.set(e.id, data)
            }
        }
        else {
            await render(alreadyLoadedDashboardOrgs.get(e.id))
        }
    })
}