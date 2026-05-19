import { addToBug } from "../lib.js";

export function appendBugs(bugs, type) {
    Object.keys(bugs).forEach((bugID, index) => {
        const bug = bugs[bugID]

        const date = new Date(parseInt(bug.date) * 1000);
        const hours = date.format("d.m, H:i");
        const day = date.format("l jS");

        const object = {
            id: bug.id,
            priority: parseInt(bug.priority),
            value: bug.title,
            desc: bug.description ?? '',
            today: hours,
            isSelf: bug.private == 1,
            org: bug.by.organization,
            resolved: bug.resolved,
            author: bug.by.name,
            assignedTo: bug.assigned_to,
            type: type
        }

        addToBug(object)
    })
}