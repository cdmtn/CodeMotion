function emptyBranch() {
    return {
        current: null,
        oid: null,
        upstream: null,
        ahead: 0,
        behind: 0
    }
}

function parseBranchLine(line, branch) {
    if (line.startsWith("# branch.oid ")) {
        branch.oid = line.slice("# branch.oid ".length).trim()
        return
    }

    if (line.startsWith("# branch.head ")) {
        const head = line.slice("# branch.head ".length).trim()
        branch.current = head === "(detached)" ? "DETACHED" : head
        return
    }

    if (line.startsWith("# branch.upstream ")) {
        branch.upstream = line.slice("# branch.upstream ".length).trim()
        return
    }

    if (line.startsWith("# branch.ab ")) {
        const match = line.match(/\+(\d+)\s+-(\d+)/)
        if (match) {
            branch.ahead = Number(match[1])
            branch.behind = Number(match[2])
        }
    }
}

function statusName(code) {
    if (!code || code === ".") return "clean"
    if (code === "?") return "untracked"
    if (code === "M") return "modified"
    if (code === "A") return "added"
    if (code === "D") return "deleted"
    if (code === "R") return "renamed"
    if (code === "C") return "copied"
    if (code === "U") return "conflicted"
    return "modified"
}

function isConflictXY(xy) {
    return xy.includes("U") || ["AA", "DD", "AU", "UA", "DU", "UD"].includes(xy)
}

function createEntry({ path, originalPath = null, xy = "..", rawType = "1" }) {
    const index = xy[0] || "."
    const worktree = xy[1] || "."
    const conflicted = rawType === "u" || isConflictXY(xy)

    return {
        path,
        originalPath,
        xy,
        index,
        worktree,
        type: conflicted
            ? "conflicted"
            : originalPath
                ? "renamed"
                : statusName(worktree !== "." ? worktree : index),
        indexStatus: statusName(index),
        worktreeStatus: statusName(worktree),
        staged: !conflicted && index !== "." && index !== "?",
        changed: !conflicted && worktree !== "." && worktree !== "?",
        untracked: xy === "??",
        conflicted
    }
}

function addToGroups(groups, entry) {
    if (entry.conflicted) {
        groups.conflicts.push({ ...entry, group: "conflicts", label: "Conflicted" })
        return
    }

    if (entry.untracked) {
        groups.untracked.push({ ...entry, group: "untracked", label: "Untracked" })
        return
    }

    if (entry.staged) {
        groups.staged.push({
            ...entry,
            group: "staged",
            label: entry.indexStatus === "clean" ? "Staged" : entry.indexStatus
        })
    }

    if (entry.changed) {
        groups.changes.push({
            ...entry,
            group: "changes",
            label: entry.worktreeStatus === "clean" ? "Modified" : entry.worktreeStatus
        })
    }
}

function parseStatusV2(raw) {
    const branch = emptyBranch()
    const entries = []
    const groups = {
        staged: [],
        changes: [],
        untracked: [],
        conflicts: []
    }

    const records = raw.split("\0").filter(Boolean)

    for (let i = 0; i < records.length; i++) {
        const record = records[i]

        if (record.startsWith("# ")) {
            parseBranchLine(record, branch)
            continue
        }

        if (record.startsWith("? ")) {
            const entry = createEntry({ path: record.slice(2), xy: "??", rawType: "?" })
            entries.push(entry)
            addToGroups(groups, entry)
            continue
        }

        if (record.startsWith("1 ")) {
            const parts = record.split(" ")
            const entry = createEntry({
                xy: parts[1],
                path: parts.slice(8).join(" "),
                rawType: "1"
            })
            entries.push(entry)
            addToGroups(groups, entry)
            continue
        }

        if (record.startsWith("2 ")) {
            const parts = record.split(" ")
            const originalPath = records[i + 1] || null
            if (originalPath) i += 1

            const entry = createEntry({
                xy: parts[1],
                path: parts.slice(9).join(" "),
                originalPath,
                rawType: "2"
            })
            entries.push(entry)
            addToGroups(groups, entry)
            continue
        }

        if (record.startsWith("u ")) {
            const parts = record.split(" ")
            const entry = createEntry({
                xy: parts[1],
                path: parts.slice(10).join(" "),
                rawType: "u"
            })
            entries.push(entry)
            addToGroups(groups, entry)
        }
    }

    return {
        branch,
        entries,
        groups,
        isClean: entries.length === 0,
        counts: {
            staged: groups.staged.length,
            changes: groups.changes.length,
            untracked: groups.untracked.length,
            conflicts: groups.conflicts.length,
            total: entries.length
        }
    }
}

module.exports = {
    parseStatusV2
}
