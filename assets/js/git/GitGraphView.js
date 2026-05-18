import { escapeHtml } from "../lib.js"

const LANE_WIDTH = 22
const ROW_HEIGHT = 42
const COLORS = ["#4c8dff", "#ffb347", "#6bdc8b", "#ff6b8a", "#a883ff", "#57d4ff", "#f6d365", "#f27f57"]

function laneColor(lane) {
    return COLORS[lane % COLORS.length]
}

function refLabels(commit) {
    const labels = []

    commit.branchLabels?.forEach(name => labels.push({ type: "branch", name }))
    commit.remoteLabels?.forEach(name => labels.push({ type: "remote", name }))
    commit.tags?.forEach(name => labels.push({ type: "tag", name }))

    if (commit.isHead) labels.unshift({ type: "head", name: "HEAD" })

    return labels
}

function renderLabels(commit) {
    return refLabels(commit)
        .map(ref => `<span class="git-ref-label ${ref.type}">${escapeHtml(ref.name)}</span>`)
        .join("")
}

function renderSvg(graph, rowByHash) {
    const width = Math.max(64, graph.lanes * LANE_WIDTH + 20)
    const height = Math.max(ROW_HEIGHT, graph.commits.length * ROW_HEIGHT)
    const paths = []
    const circles = []

    graph.edges.forEach(edge => {
        const fromRow = rowByHash.get(edge.from)
        const toRow = rowByHash.get(edge.to)
        if (fromRow == null || toRow == null) return

        const x1 = edge.fromLane * LANE_WIDTH + 12
        const y1 = fromRow * ROW_HEIGHT + ROW_HEIGHT / 2
        const x2 = edge.toLane * LANE_WIDTH + 12
        const y2 = toRow * ROW_HEIGHT + ROW_HEIGHT / 2
        const midY = y1 + Math.max(16, (y2 - y1) / 2)

        const d = x1 === x2
            ? `M ${x1} ${y1} L ${x2} ${y2}`
            : `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`

        paths.push(`<path d="${d}" stroke="${laneColor(edge.fromLane)}" class="${edge.merge ? "merge" : ""}" />`)
    })

    graph.commits.forEach(commit => {
        const x = commit.laneIndex * LANE_WIDTH + 12
        const y = commit.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2
        circles.push(`<circle cx="${x}" cy="${y}" r="${commit.isHead ? 5 : 4}" fill="${laneColor(commit.laneIndex)}" class="${commit.isHead ? "head" : ""}" />`)
    })

    return `
        <svg class="git-graph-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
            ${paths.join("")}
            ${circles.join("")}
        </svg>
    `
}

export function renderGitGraph(container, graph, onCommitClick) {
    if (!graph?.commits?.length) {
        container.innerHTML = `<div class="git-empty-state">No commits yet</div>`
        return
    }

    const rowByHash = new Map(graph.commits.map(commit => [commit.fullHash, commit.rowIndex]))

    container.innerHTML = `
        <div class="git-graph" style="--git-graph-lanes:${graph.lanes}">
            <div class="git-graph__lines">
                ${renderSvg(graph, rowByHash)}
            </div>
            <div class="git-graph__rows">
                ${graph.commits.map(commit => `
                    <button class="git-graph-row" data-hash="${commit.fullHash}">
                        <span class="git-graph-row__message">${escapeHtml(commit.message)}</span>
                        <span class="git-graph-row__refs">${renderLabels(commit)}</span>
                        <span class="git-graph-row__meta">${escapeHtml(commit.shortHash)} · ${escapeHtml(commit.author)} · ${escapeHtml(new Date(commit.date).toLocaleDateString())}</span>
                    </button>
                `).join("")}
            </div>
        </div>
    `

    container.querySelectorAll(".git-graph-row").forEach(row => {
        row.addEventListener("click", () => {
            const commit = graph.commits.find(item => item.fullHash === row.dataset.hash)
            if (commit) onCommitClick(commit)
        })
    })
}
