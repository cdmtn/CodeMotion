const { parseRefs } = require("./GitLogParser.js")

function getOrCreateLane(activeLanes, hash) {
    let index = activeLanes.indexOf(hash)
    if (index !== -1) return index

    index = activeLanes.findIndex(value => value === null)
    if (index === -1) index = activeLanes.length

    activeLanes[index] = hash
    return index
}

function buildGraph(commits) {
    const activeLanes = []
    const nodes = []
    const edges = []

    commits.forEach((commit, rowIndex) => {
        const laneIndex = getOrCreateLane(activeLanes, commit.fullHash)
        const parentConnections = []

        commit.parents.forEach((parentHash, parentIndex) => {
            const parentLane = parentIndex === 0
                ? laneIndex
                : getOrCreateLane(activeLanes, parentHash)

            parentConnections.push({
                fromLane: laneIndex,
                toLane: parentLane,
                parentHash
            })

            edges.push({
                from: commit.fullHash,
                to: parentHash,
                fromLane: laneIndex,
                toLane: parentLane,
                merge: parentIndex > 0
            })
        })

        if (commit.parents.length === 0) {
            activeLanes[laneIndex] = null
        } else {
            activeLanes[laneIndex] = commit.parents[0]
            commit.parents.slice(1).forEach(parentHash => {
                getOrCreateLane(activeLanes, parentHash)
            })
        }

        nodes.push({
            ...commit,
            laneIndex,
            rowIndex,
            connectionsToParents: parentConnections,
            activeLanes: activeLanes.slice()
        })
    })

    return {
        commits: nodes,
        edges,
        lanes: Math.max(1, ...nodes.map(node => node.laneIndex + 1), activeLanes.length)
    }
}

function parseDecoratedLog(raw) {
    return raw
        .split("\x1e")
        .map(chunk => chunk.trim())
        .filter(Boolean)
        .map(chunk => {
            const fields = chunk.split("\x1f")
            const refs = parseRefs(fields[5] || "")

            return {
                fullHash: fields[0],
                shortHash: fields[0]?.slice(0, 8),
                parents: fields[1] ? fields[1].split(" ").filter(Boolean) : [],
                author: fields[2],
                date: fields[3],
                message: fields[4] || "",
                refs: refs.refs,
                branchLabels: refs.branches,
                remoteLabels: refs.remotes,
                tags: refs.tags,
                isHead: refs.head
            }
        })
}

module.exports = {
    buildGraph,
    parseDecoratedLog
}
