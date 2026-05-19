import { generateAvatar, truncateString, GLOBAL } from "./lib.js";
import { ExistingModal, modalVerifiedBadgeHTML, modalOwnerBadgeHTML } from "../components/modalHandler.js";
import { Modal } from "./modalsHandler/engine.js";

import { spawnSideBarOrganizationsButton } from "./userHandlers/spawn.js"
import { createUserOrgsModalStructure } from "./userHandlers/orgModal.js";
import { appendBugs } from "./userHandlers/appendBugs.js"
import { createUserOrgModal } from "./userHandlers/orgModal.js";

import { setUserPcInfo } from "./userHandlers/userPC.js";

export async function getCurrentUserDataFromAPI(gls) {
    const user = await window.electron.getCurrentUserDataFromAPI();
    const greeting = document.querySelector("#greeting")

    setUserPcInfo()

    if (!user.success) return user;

    const userJSON = user.result.result.user;
    const userOrgs = user.result.result.organizations;
    let bugsCreated = user.result.result.bugs.created
    let bugsAssigned = user.result.result.bugs.assigned

    GLOBAL["user"] = userJSON

    // organizations

    spawnSideBarOrganizationsButton({ gls: gls, userOrgs: userOrgs })

    const organizationsModal = await createUserOrgModal(
        { 
            gls: gls,
            userOrgs: userOrgs,
            userJSON: userJSON
        }
    )
    organizationsModal.bind(document.querySelectorAll("#yourOrganizations"))

    // 

    document.querySelectorAll("#username").forEach(e => e.textContent = userJSON.name);
    document.querySelectorAll("#greeting").forEach(e => e.textContent = gls.get("greeting.default", { name: userJSON.name }));
    document.querySelectorAll("#bug_counter").forEach(e => e.textContent = bugs.length);
    document.querySelector("#userAvatar").innerHTML = generateAvatar(userJSON.name)

    appendBugs(bugsCreated, "created")
    appendBugs(bugsAssigned, "assigned")

    return user;
}