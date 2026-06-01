import { Modal } from "../modalsHandler/engine.js"
import { createNotify, getInitials, Options, truncateString } from "../lib.js"
import { sendEvent } from "../bus.js"
import { dashboardModalHandle, dashboardModalObject } from "./organizationModal/dashboard.js"
import { createNewModalHandle, createNewModalObject } from "./organizationModal/create-new.js"
import { joinModalHandle, joinModalObject } from "./organizationModal/join.js"

export async function createUserOrgsModalStructure({ gls, userOrgs, userJSON, roleVisible }) {
    roleVisible = roleVisible == undefined ? true : roleVisible

    const organizationsModalData = await Promise.all(
        userOrgs.map(async (organization) => {
            const organizationReq =
                await window.electron.getOrgDataFromAPI(organization.id)

            if (!organizationReq.success) {
                throw new Error(
                    `Error getting organization data: ${organization.id}`
                )
            }

            const organizationData = organizationReq.msg

            const organizationRole =
                organization.role?.length > 0
                    ? organization.role
                    : "No role"

            const isOwner = organizationData.is_owner

            const preparedData = {
                type: "organization",

                name: organizationData.name,

                description:
                    organizationData.description,

                website:
                    organizationData.website,

                columns: [
                    {
                        name: gls.get(
                            "modals.organizations.membersLabel"
                        ),

                        value:
                            organizationData.members_count
                    },

                    {
                        name: gls.get(
                            "modals.organizations.roleLabel"
                        ),

                        value: isOwner
                            ? gls.get(
                                "modals.organizations.ownerRoleLabel"
                            )
                            : organizationRole
                    }
                ],

                badgeOwner: isOwner,

                badgeVerified:
                    organizationData.verified == 1
            }

            if(!roleVisible) {
                delete preparedData["columns"][1]
            }

            if (isOwner) {
                preparedData.note = `
                    ${gls.get("modals.organizations.ownerLabel")}
                    ${
                        organization.role?.length > 0
                            ? gls.get(
                                "modals.organizations.ownerLabel",
                                {
                                    role: organization.role
                                }
                            )
                            : ""
                    }
                `
                    .trim()
            }

            return preparedData
        })
    )

    return organizationsModalData
}

export async function createUserOrgModal({ gls, userOrgs, userJSON }) {
    function lgls(string, variables = {}) {
        return gls.get(`modals.organizations.${string}`, variables)
    }

    const exploreOrganizationsRes = await window.electron.requestExploreOrganizations()

    const errorPlaceholder = {
        type: "placeholder",
        title: gls.get("errorPlaceholder.title"),
        description: gls.get("errorPlaceholder.description")
    }

    let exploreItems = []
    let membershipItems = []

    if(exploreOrganizationsRes.success) {
        if(exploreOrganizationsRes.msg.length == 0) {
            exploreItems = [
                {
                    type: "centered",
                    icon: "explore"
                }
            ]
        }
        else {
            exploreItems = await createUserOrgsModalStructure({ gls: gls, userOrgs: exploreOrganizationsRes.msg, userJSON: userJSON, roleVisible: false })
        }
    }
    else {
        exploreItems = [errorPlaceholder]
    }

    if(Object.keys(userOrgs).length == 0) {
        membershipItems = [
            {
                type: "centered",
                icon: "group"
            }
        ]
    }
    else {
        membershipItems = await createUserOrgsModalStructure({ gls: gls, userOrgs: userOrgs, userJSON: userJSON })
    }

    const orgModal = Modal.create({
        id: "organizations",
        name: "Organizations",
        modalClassList: ["window"],
        title: lgls("title"),

        pages: [
            {
                name: lgls("explore.title"),
                icon: "explore",
                label: exploreOrganizationsRes.success ? Object.keys(exploreOrganizationsRes.msg).length : 0,

                content: [
                    {
                        type: "row",
                        gap: 10,
                        items: exploreItems
                    }
                ]
            },
            {
                name: lgls("membership.title"),
                icon: "group",
                label: Object.keys(userOrgs).length,

                content: [
                    {
                        type: "row",
                        gap: 10,
                        items: membershipItems
                    }
                ]
            },
            dashboardModalObject({ lgls: lgls }),
            {
                divider: true
            },
            createNewModalObject({ lgls: lgls }),
            joinModalObject({ lgls: lgls })
        ]
    })

    const element = orgModal.el
    const createOrgNameField = element.querySelector("#orgName")
    const createOrgDescField = element.querySelector("#orgDesc")
    const createOrgWebsiteField = element.querySelector("#orgWebsite")
    const createOrgSubmitBtn = element.querySelector("#orgConfirm")
    const modalPreview = element.querySelector(".modal-org#orgPreview")

    // create organization

    createNewModalHandle(
        {
            lgls: lgls,
            modalPreview: modalPreview,
            createOrgNameField: createOrgNameField,
            createOrgDescField: createOrgDescField,
            createOrgWebsiteField: createOrgWebsiteField,
            createOrgSubmitBtn: createOrgSubmitBtn,
            orgModal: orgModal,
            element: element
        }
    )

    // dashboard

    dashboardModalHandle({
        userOrgs: userOrgs,
        element: element,
        orgModal: orgModal
    })

    // 

    // join

    joinModalHandle({ 
        element: element,
        lgls: lgls
    })

    // 

    return orgModal
}