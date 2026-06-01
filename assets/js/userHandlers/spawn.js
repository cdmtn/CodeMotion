export function spawnSideBarOrganizationsButton({ gls, userOrgs }) {
    if (userOrgs.length > 0) {
        if(!document.querySelector(".sidebar-item#yourOrganizations")) {
            const orgSideBarBtn = document.createElement("div")
            orgSideBarBtn.className = "sidebar-item"
            orgSideBarBtn.id = "yourOrganizations"
            orgSideBarBtn.setAttribute("tooltip", gls.get("tooltips.organizations"))
            orgSideBarBtn.setAttribute("nondefault", null)

            orgSideBarBtn.innerHTML = `
                <span class="badge default">${userOrgs.length}</span>
                <span class="material-symbols-rounded">group</span>
            `
            document.querySelector(".sidebar").appendChild(orgSideBarBtn)
        }
        else {
            const el = document.querySelector(".sidebar-item#yourOrganizations")
            el.querySelector(".badge").textContent = userOrgs.length
        }
    }
}