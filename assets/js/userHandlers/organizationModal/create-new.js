import { sendEvent } from "../../bus.js"
import { createNotify, getInitials, truncateString } from "../../lib.js"

export function createNewModalObject({ lgls }) {
    return {
        name: lgls("createNew.title"),
        icon: "add",

        content: [
            {
                type: "row-clear",
                gap: 10,
                items: [
                    {
                        type: "placeholder",
                        title: lgls("createNew.header.title"),
                        description: lgls("createNew.header.description")
                    },
                    {
                        type: "input",
                        placeholder: lgls("createNew.inputs.name"),
                        id: "orgName"
                    },
                    {
                        type: "input",
                        placeholder: lgls("createNew.inputs.about"),
                        id: "orgDesc"
                    },
                    {
                        type: "input",
                        placeholder: lgls("createNew.inputs.website"),
                        id: "orgWebsite"
                    },
                    {
                        type: "divider"
                    },
                    {
                        type: "placeholder",
                        title: lgls("createNew.preview.title"),
                        description: lgls("createNew.preview.description")
                    },
                    {
                        id: "orgPreview",
                        type: "organization",
                        name: lgls("createNew.preview.emptyName"),
                        description: lgls("createNew.preview.emptyDescription"),
                        columns: [
                            {
                                name: lgls("membersLabel"),
                                value: 1
                            },
                            {
                                name: lgls("roleLabel"),
                                value: lgls("ownerRoleLabel")
                            }
                        ],
                        website: "https://example.com/",
                        badgeOwner: true
                    },
                    {
                        type: "container",
                        id: "buttonsContainer"
                    },
                    {
                        type: "button",
                        id: "orgConfirm",
                        title: lgls("buttons.create"),
                        container: "#buttonsContainer"
                    }
                ]
            }
        ]
    }
}

export function createNewModalHandle(
    {
        lgls,
        createOrgNameField,
        modalPreview,
        createOrgDescField,
        createOrgWebsiteField,
        createOrgSubmitBtn,
        orgModal,
        element
    }
) {
    createOrgNameField.addEventListener("input", (e) => {
        modalPreview.querySelector(".modal-org__title p").textContent = e.target.value
        modalPreview.querySelector(".generated-avatar").textContent = getInitials(e.target.value)

        if (e.target.value.length == 0) {
            modalPreview.querySelector(".modal-org__title p").textContent = lgls("createNew.preview.emptyName")
            modalPreview.querySelector(".generated-avatar").textContent = getInitials("U")
        }
    })
    createOrgDescField.addEventListener("input", (e) => {
        modalPreview.querySelector(".modal-org-description").textContent = truncateString(e.target.value, 100)

        if (e.target.value.length == 0) {
            modalPreview.querySelector(".modal-org-description").textContent = lgls("createNew.preview.emptyDescription")
        }
    })
    createOrgWebsiteField.addEventListener("input", (e) => {
        modalPreview.querySelector(".modal-org-icontext a").textContent = e.target.value

        if (e.target.value.length == 0) {
            modalPreview.querySelector(".modal-org-icontext a").textContent = "example.com"
        }
    })

    createOrgSubmitBtn.addEventListener("click", async () => {
        const name = createOrgNameField.value
        const desc = createOrgDescField.value
        const website = createOrgWebsiteField.value

        const createOrgRes = await window.electron.createOrganization(
            {
                name: name,
                description: desc,
                website: website
            }
        )

        if (!createOrgRes.success) {
            createNotify(
                {
                    type: "danger",
                    icon: "close",
                    title: lgls("notifications.creatingError.title"),
                    content: createOrgRes.msg.message == undefined ? createOrgRes.msg : createOrgRes.msg.message
                }
            )
        }
        else {
            orgModal.close()

            element.addEventListener("transitionend", () => {
                sendEvent("org-created", {})
            })

            createNotify(
                {
                    type: "success",
                    icon: "check",
                    title: lgls("notifications.creatingSuccess.title"),
                    content: lgls("notifications.creatingSuccess.description", { name: createOrgRes.msg.name })
                }
            )
        }
    })
}