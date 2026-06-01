import { setTabNameCounter, escapeHtml, createNotify, capitilize } from "../lib.js"
import { ELEMENTS_EMPTY_TEXT_COMPONENT } from "./components.js"
import { priorityClasses } from "../objects.js"
import { GLS } from "../lib.js"

import { requestUser } from "../user.js"
import { appendBugs } from "../userHandlers/appendBugs.js"

const root = document.querySelector(`.explorer-elements[data-tab="bugs"] .elements`);
const rootParent = document.querySelector(`.explorer-elements[data-tab="bugs"]`);

async function refreshBugs() {
    const user = await requestUser()

    const bugsCreated = user.bugsCreated
    const bugsAssigned = user.bugsAssigned

    console.log({ ...bugsCreated, ...bugsAssigned })

    appendBugs(bugsCreated, "created")
    appendBugs(bugsAssigned, "assigned")

    console.log(bugsObject)

    handleBugsTab(bugsObject)
}

document.querySelector("#refresh_bugs").addEventListener("click", (e) => {
    refreshBugs()

    e.target.classList.add("disabled")

    setTimeout(() => {
        e.target.classList.remove("disabled")
    }, 5000)
})

export async function handleBugsTab(bugsObject) {
    console.log(bugsObject)
    const gls = await GLS.init()

    if (!root) return

    root.innerHTML = ""

    const bugs = Object.entries(bugsObject)
    setTabNameCounter(bugs.length)

    if (bugs.length === 0) {
        root.innerHTML = ELEMENTS_EMPTY_TEXT_COMPONENT
        return
    }

    for (const [id, rec] of bugs) {
        const {
            self,
            priority,
            resolved,
            value,
            description,
            time,
            organization,
            author,
            assignedTo,
            type
        } = rec

        let organizationsHTML = ""
        let resolveBtnHTML = ""
        let bugPriority = priorityClasses[priority]

        if (organization) {
            const splitted = organization.split(",").map(i => i.trim())

            if (splitted.length > 1) {
                organizationsHTML = `
                    <p class="column-element__second-element clickable" data-full-org>
                        <span class="material-symbols-rounded">group</span>
                        <span data-org-target>${escapeHtml(splitted[0])} ${gls.get("bug.orgMore", { count: splitted.length - 1 })}</span>
                    </p>`
            }
            else {
                organizationsHTML = `
                    <p class="column-element__second-element">
                        <span class="material-symbols-rounded">group</span>
                        ${escapeHtml(organization)}
                    </p>`
            }
        }

        if (!resolved) {
            resolveBtnHTML = `
                <button class="btn done-btn" data-done>
                    <span class="material-symbols-rounded">check</span>
                </button>`
        }

        const columnElementClassList = []

        if(self) columnElementClassList.push("own")
        if(resolved) columnElementClassList.push("done")
        
        columnElementClassList.push(`${bugPriority.name}-priority`)
        columnElementClassList.push(type)

        root.insertAdjacentHTML("beforeend", `
            <div class="column-element ${columnElementClassList.join(" ")}" data-id="${id}">
                <div class="column-element__title">
                    <div class="column-element__title-element">
                        <p class="column-element__title-element__name">${escapeHtml(value)}</p>
                        <p class="column-element__title-element__description">${escapeHtml(description)}</p>
                        <div class="column-element__seconds">
                            ${organizationsHTML}
                            <div class="column-element__second-element">
                                <span class="material-symbols-rounded">person</span>
                                ${gls.get("bug.createdBy", { name: author })}
                            </div>
                            <div class="column-element__second-element">
                                <span class="material-symbols-rounded">commit</span>
                                ${gls.get("bug.assignedTo", { name: assignedTo.name })}
                            </div>
                            ${self ? `
                            <div class="column-element__second-element">
                                <span class="material-symbols-rounded">visibility_off</span>
                                ${gls.get("bug.private")}
                            </div>
                            ` : ""}
                            <div class="column-element__second-element">
                                ${gls.get(`bug.priority.${bugPriority.name}`)}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="column-element__time">
                    <p>${/^\d{10}$/.test(String(time))
                        ? new Date(time * 1000).format("H:i")
                        : escapeHtml(String(time || "Unknown"))}</p>
                </div>

                <div class="column-element__buttons">
                    ${resolveBtnHTML}
                </div>
            </div>
        `)
    }

    if (!root.dataset.listenerAttached) {
        root.addEventListener("click", async (e) => {
            const orgEl = e.target.closest("[data-full-org]")

            if (orgEl) {
                const target = orgEl.querySelector("[data-org-target]")
                const id = orgEl.closest(".column-element")?.dataset.id
                const orgs = bugsObject[id]?.organization

                if (target && orgs) {
                    target.textContent = orgs
                }
            }

            const doneBtn = e.target.closest("[data-done]")

            if (doneBtn) {
                const item = doneBtn.closest(".column-element")
                const id = item?.dataset.id
                const bug = bugsObject[id]

                if (!bug) return

                bug.resolved = 1

                const res = await window.electron.requestMakeVerifyBug({ bugid: id })

                if(res.success) {
                    item.classList.add("done")
                    doneBtn.remove()
                }
                else {
                    createNotify(
                        {
                            icon: "close",
                            title: "Bug verify error",
                            content: res.msg
                        }
                    )
                }
            }
        })

        root.dataset.listenerAttached = "true"
    }

    function showAllBugs() {
        rootParent.querySelectorAll(".column-element").forEach(e => {
            e.classList.remove("hidden")
        })
    }

    if (!rootParent.dataset.segmentListenersAttached) {
        const tabs = document.querySelectorAll(".segmented-picker label")

        tabs.forEach(t => {
            t.addEventListener("click", (e) => {
                let el = e.target
                let ID

                if(el.tagName == "SPAN") {
                    el = el.parentElement
                    ID = el.getAttribute("for")
                }
                else {
                    el = e.target
                    ID = el.getAttribute("for")
                }

                if(ID != "bugs-all") {
                    document.querySelector(`#${ID}`)?.addEventListener("click", () => {
                        showAllBugs()

                        const classToActive = el.getAttribute("classToActive")

                        rootParent.querySelectorAll(".column-element").forEach(e => {
                            if (!e.classList.contains(classToActive)) {
                                e.classList.add("hidden")
                            }
                        })
                    })
                }
                else {
                    document.querySelector(`#${ID}`)?.addEventListener("click", () => {
                        showAllBugs()
                    })
                }
            })
        })

        rootParent.dataset.segmentListenersAttached = "true"
    }
}