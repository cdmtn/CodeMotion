import { generateAvatar, truncateString, GLOBAL } from "./lib.js";
import { ExistingModal, modalVerifiedBadgeHTML, modalOwnerBadgeHTML } from "../components/modalHandler.js";
import { Modal } from "./modalsHandler/engine.js";

export async function getCurrentUserDataFromAPI() {
    const user = await window.electron.getCurrentUserDataFromAPI();
    const greeting = document.querySelector("#greeting")

    if (!user.success) return user;

    const userJSON = user.result.result.user;
    const userOrgs = user.result.result.organizations;
    let bugs = userJSON.bugs

    GLOBAL["user"] = userJSON

    // organizations

    if (userOrgs.length > 0) {
        // if user at least in 1 org, then creating a sidebar btn
        const orgSideBarBtn = document.createElement("div")
        orgSideBarBtn.className = "sidebar-item"
        orgSideBarBtn.id = "yourOrganizations"
        orgSideBarBtn.setAttribute("tooltip", "Organizations")
        orgSideBarBtn.setAttribute("nondefault", null)

        orgSideBarBtn.innerHTML = `
            <span class="badge default">${userOrgs.length}</span>
            <span class="material-symbols-rounded">group</span>
        `
        document.querySelector(".sidebar").appendChild(orgSideBarBtn)
    }

    const organizationsModalData = []

    for (const org in userOrgs) {
        const organization = userOrgs[org]
        const organizationReq = await window.electron.getOrgDataFromAPI(organization.id)

        if (!organizationReq.success) throw new Error(`Error getting organizations data:`, organizationReq.result)

        const organizationMembersCount = organizationReq.result.data.members_count
        const organizationData = organizationReq.result.data

        let organizationRole = organization.role

        if(organizationRole.length == 0) organizationRole = "No role"

        const organizationPreparedData = {
            type: "organization",
            name: organizationData.name,
            description: organizationData.description,
            website: organizationData.website,
            columns: [
                {
                    name: "Members",
                    value: organizationMembersCount
                },
                {
                    name: "Role",
                    value: userJSON.id == organizationData.ownerID ? "Owner" : organizationRole
                }
            ],
            badgeOwner: userJSON.id == organizationData.ownerID,
            badgeVerified: organizationData.verified == 1
        }

        if(userJSON.id == organizationData.ownerID) {
            organizationPreparedData["note"] = `You are the founder of this organization. ${organization.role.length != 0 ? `Your second role: ${organization.role}` : ""}`
        }

        organizationsModalData.push(organizationPreparedData)
    }

    const organizationsModal = Modal.create({
        id: "organizations",
        name: "Organizations",
        modalClassList: ["window"],
        title: "Organizations",

        content: [
            {
                type: "columns",
                cols: 2,
                gap: 10,
                items: organizationsModalData
            },
        ]
    })

    organizationsModal.bind(document.querySelectorAll("#yourOrganizations"))

    // 

    document.querySelectorAll("#username").forEach(e => e.textContent = userJSON.name);
    document.querySelectorAll("#greeting").forEach(e => e.textContent = `How do you feel today, ${userJSON.name}?`);
    document.querySelectorAll("#bug_counter").forEach(e => e.textContent = bugs.length);
    document.querySelector("#userAvatar").innerHTML = generateAvatar(userJSON.name)

    Object.keys(bugs).forEach((bugID, index) => {
        let bug = bugs[bugID]

        const date = new Date(parseInt(bug.date) * 1000);
        const hours = date.format("H:i");
        const day = date.format("l jS");

        addToBug(
            {
                priority: parseInt(bug.priority),
                value: bug.title,
                desc: `${bug.description ?? "No description provided"}. added by ${bug.by.name} at ${day}`,
                today: hours,
                isSelf: false,
                org: bug.by.organization,
                resolved: bug.resolved
            }
        );
    })

    return user;
}
export async function setUserPcInfo() {
    const info = await window.electron.getUserPcInfo();
    document.querySelectorAll("#username").forEach(e => { e.textContent = info.name; });

    function updateTime() {
        const now = new Date().format("F j, H:i");
        document.querySelectorAll("#current_hours").forEach(el => { el.textContent = now; });
    }
    updateTime();
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    setTimeout(function tick() {
        updateTime();
        setInterval(updateTime, 60 * 1000);
    }, msToNextMinute);
}