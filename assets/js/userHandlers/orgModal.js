import { Modal } from "../modalsHandler/engine.js"

export async function createUserOrgsModalStructure({ gls, userOrgs, userJSON }) {
    const organizationsModalData = []

    for (const org in userOrgs) {
        const organization = userOrgs[org]
        const organizationReq = await window.electron.getOrgDataFromAPI(organization.id)

        if (!organizationReq.success) throw new Error(`Error getting organizations data:`, organizationReq.result)

        const organizationMembersCount = organizationReq.result.data.members_count
        const organizationData = organizationReq.result.data

        let organizationRole = organization.role

        if (organizationRole.length == 0) organizationRole = "No role"

        const organizationPreparedData = {
            type: "organization",
            name: organizationData.name,
            description: organizationData.description,
            website: organizationData.website,
            columns: [
                {
                    name: gls.get("modals.organizations.membersLabel"),
                    value: organizationMembersCount
                },
                {
                    name: gls.get("modals.organizations.roleLabel"),
                    value: userJSON.id == organizationData.ownerID ? gls.get("modals.organizations.ownerRoleLabel") : organizationRole
                }
            ],
            badgeOwner: userJSON.id == organizationData.ownerID,
            badgeVerified: organizationData.verified == 1
        }

        if (userJSON.id == organizationData.ownerID) {
            organizationPreparedData["note"] =
                `${gls.get("modals.organizations.ownerLabel")}.
            ${organization.role.length != 0 ? gls.get("modals.organizations.ownerLabel", { role: organization.role }) : ""}
            `
        }

        organizationsModalData.push(organizationPreparedData)
    }

    return organizationsModalData
}

export async function createUserOrgModal({ gls, userOrgs, userJSON }) {
    return Modal.create({
        id: "organizations",
        name: "Organizations",
        modalClassList: ["window"],
        title: gls.get("modals.organizations.title"),

        pages: [
            {
                name: "Membership",
                icon: "group",

                content: [
                    {
                        type: "row",
                        gap: 10,
                        items: await createUserOrgsModalStructure({ gls: gls, userOrgs: userOrgs, userJSON: userJSON })
                    }
                ]
            },
            {
                name: "Create new",
                icon: "add",

                content: []
            }
        ]
    })
}