import { escapeHtml, createNotify } from "../lib.js"
import { showGitDiff } from "./GitDiffViewer.js"
import { renderGitGraph } from "./GitGraphView.js"
import { GitBlameOverlay } from "./GitBlameOverlay.js"

const GROUPS = [
    { id: "conflicts", title: "Conflicts", icon: "warning", action: "stage", empty: "No conflicts" },
    { id: "staged", title: "Staged Changes", icon: "task_alt", action: "unstage", empty: "No staged files" },
    { id: "changes", title: "Changes", icon: "edit_square", action: "stage", empty: "No changes" },
    { id: "untracked", title: "Untracked", icon: "note_add", action: "stage", empty: "No untracked files" }
]

const STATUS_CLASS = {
    modified: "modified",
    added: "added",
    deleted: "deleted",
    renamed: "renamed",
    copied: "renamed",
    untracked: "untracked",
    conflicted: "conflicted",
    clean: "clean"
}

function ensure(response) {
    if (!response?.success) {
        throw new Error(response?.error || "Git operation failed")
    }

    return response.result
}

function notify(title, content, icon = "check") {
    createNotify({ icon, title, content, time: 3500 })
}

function shortDate(date) {
    if (!date) return ""

    try {
        return new Date(date).toLocaleString()
    } catch {
        return date
    }
}

function statusClass(entry) {
    return STATUS_CLASS[entry.type] || STATUS_CLASS[entry.label] || "modified"
}

function statusLabel(entry) {
    if (entry.label) return entry.label
    if (entry.type) return entry.type
    return "Modified"
}

function fileName(filePath) {
    return filePath.split(/[\\/]/).pop()
}

function dirname(filePath) {
    const parts = filePath.split(/[\\/]/)
    parts.pop()
    return parts.join("/")
}

function renderButton(action, icon, title, extra = "") {
    return `
        <button class="git-icon-btn" data-action="${action}" title="${escapeHtml(title)}" ${extra}>
            <span class="material-symbols-rounded outline">${icon}</span>
        </button>
    `
}

class GitContextMenu {
    constructor() {
        this.el = document.createElement("div")
        this.el.className = "context-menu git-context-menu hidden"
        document.body.appendChild(this.el)
        document.addEventListener("click", () => this.hide())
        document.addEventListener("keydown", event => {
            if (event.key === "Escape") this.hide()
        })
    }

    hide() {
        this.el.classList.add("hidden")
    }

    show(event, items) {
        event.preventDefault()
        event.stopPropagation()

        this.el.innerHTML = items.map(item => {
            if (item.type === "divider") {
                return `<div class="context-menu__item-divider"><div></div></div>`
            }

            return `
                <div class="context-menu__item ${item.disabled ? "disabled" : ""}" data-id="${escapeHtml(item.id)}">
                    <div class="context-menu__item-block">
                        <span class="material-symbols-rounded outline">${item.icon || "radio_button_unchecked"}</span>
                        <div class="content">${escapeHtml(item.label)}</div>
                    </div>
                </div>
            `
        }).join("")

        items.forEach(item => {
            if (!item.id || item.disabled) return
            this.el.querySelector(`[data-id="${item.id}"]`)?.addEventListener("click", () => {
                this.hide()
                item.action()
            })
        })

        this.el.classList.remove("hidden")
        const edgeGap = 8
        const left = Math.min(event.clientX, window.innerWidth - this.el.offsetWidth - edgeGap)
        const top = Math.min(event.clientY, window.innerHeight - this.el.offsetHeight - edgeGap)

        this.el.style.left = `${Math.max(edgeGap, left)}px`
        this.el.style.top = `${Math.max(edgeGap, top)}px`
    }
}

export class GitPanel {
    constructor({ pathContext }) {
        this.pathContext = pathContext
        this.root = document.querySelector(`.explorer-elements[data-tab="git"]`)
        this.state = {
            activeView: "changes",
            status: null,
            branches: null,
            log: null,
            graph: null,
            selectedCommit: null,
            loading: false
        }
        this.contextMenu = new GitContextMenu()
        this.blameOverlay = new GitBlameOverlay(pathContext)

        this.bind()
        this.render()
    }

    get rootPath() {
        return this.pathContext.rootPath
    }

    bind() {
        if (!this.root) return

        this.root.addEventListener("click", event => {
            const actionEl = event.target.closest("[data-action]")
            if (!actionEl) return

            this.handleAction(actionEl.dataset.action, actionEl)
        })

        this.root.addEventListener("change", event => {
            const viewInput = event.target.closest("[name='git-panel-view']")
            if (!viewInput) return

            this.state.activeView = viewInput.value
            this.render()
            this.ensureViewData()
        })

        this.root.addEventListener("contextmenu", event => {
            const fileEl = event.target.closest(".git-file-row")
            const commitEl = event.target.closest(".git-commit-row")
            const branchEl = event.target.closest(".git-branch-row")

            if (fileEl) {
                this.showFileMenu(event, fileEl)
                return
            }
            if (commitEl) {
                this.showCommitMenu(event, commitEl)
                return
            }
            if (branchEl) {
                this.showBranchMenu(event, branchEl)
            }
        })
    }

    setLoading(value, text = "Loading Git data...") {
        this.state.loading = value
        const loader = this.root?.querySelector(".git-panel__loading")
        if (!loader) return

        loader.classList.toggle("hidden", !value)
        loader.querySelector("span:last-child").textContent = text
    }

    async loadInitial() {
        await this.refresh()
    }

    async refresh() {
        if (!this.rootPath) {
            this.state.status = null
            this.render()
            return
        }

        this.setLoading(true)
        try {
            const [status, branches] = await Promise.all([
                window.electron.gitStatus(this.rootPath),
                window.electron.gitBranches(this.rootPath)
            ])

            this.state.status = ensure(status)
            this.state.branches = ensure(branches)
            this.render()
            await this.ensureViewData()
        } catch (error) {
            this.state.status = null
            this.state.branches = null
            this.renderError(error.message)
        } finally {
            this.setLoading(false)
        }
    }

    async ensureViewData() {
        if (!this.rootPath) return

        if (this.state.activeView === "history" && !this.state.log) {
            await this.loadHistory()
        }

        if (this.state.activeView === "graph" && !this.state.graph) {
            await this.loadGraph()
        }
    }

    async loadHistory(limit = 300) {
        this.setLoading(true, "Loading commit history...")
        try {
            this.state.log = ensure(await window.electron.gitLog(this.rootPath, limit))
            this.render()
        } catch (error) {
            notify("Git history error", error.message, "error")
        } finally {
            this.setLoading(false)
        }
    }

    async loadGraph(limit = 400) {
        this.setLoading(true, "Building commit graph...")
        try {
            this.state.graph = ensure(await window.electron.gitGraph(this.rootPath, limit))
            this.render()
        } catch (error) {
            notify("Git graph error", error.message, "error")
        } finally {
            this.setLoading(false)
        }
    }

    render() {
        if (!this.root) return

        if (!this.rootPath) {
            this.root.innerHTML = `
                <div class="git-panel">
                    <div class="git-empty-state">
                        <span class="material-symbols-rounded outline">folder_open</span>
                        Open a folder to use Git
                    </div>
                </div>
            `
            return
        }

        this.root.innerHTML = `
            <div class="git-panel">
                ${this.renderHeader()}
                ${this.renderViews()}
                <div class="git-panel__loading hidden">
                    <span class="material-symbols-rounded outline">progress_activity</span>
                    <span>Loading Git data...</span>
                </div>
            </div>
        `

        if (this.state.activeView === "graph" && this.state.graph) {
            renderGitGraph(
                this.root.querySelector(".git-graph-host"),
                this.state.graph,
                commit => this.openCommitDiff(commit.fullHash)
            )
        }
    }

    renderError(message) {
        this.root.innerHTML = `
            <div class="git-panel">
                <div class="git-empty-state error">
                    <span class="material-symbols-rounded outline">warning</span>
                    <span>${escapeHtml(message)}</span>
                    <button class="git-button" data-action="refresh">Retry</button>
                </div>
            </div>
        `
    }

    renderHeader() {
        const status = this.state.status
        const branch = this.state.branches

        return `
            <div class="git-panel__header">
                <div class="git-branch-chip">
                    <span class="material-symbols-rounded outline">account_tree</span>
                    <span>${escapeHtml(branch?.current || status?.branch?.current || "No branch")}</span>
                </div>
                <div class="git-ahead-behind">
                    ${branch?.upstream ? `<span>${escapeHtml(branch.upstream)}</span>` : `<span>No upstream</span>`}
                    <span class="${branch?.ahead ? "active" : ""}">↑ ${branch?.ahead ?? 0}</span>
                    <span class="${branch?.behind ? "active" : ""}">↓ ${branch?.behind ?? 0}</span>
                </div>
                <div class="git-toolbar">
                    ${renderButton("refresh", "refresh", "Refresh")}
                    ${renderButton("fetch", "download", "Fetch")}
                    ${renderButton("pull", "south", "Pull")}
                    ${renderButton("push", "north", "Push current branch")}
                    ${renderButton("blame", "manage_search", "Toggle blame for active file")}
                </div>
            </div>
        `
    }

    renderViews() {
        const active = this.state.activeView

        return `
            <div class="segmented-picker git-view-switch">
                <input id="git-view-changes" type="radio" name="git-panel-view" value="changes" ${active === "changes" ? "checked" : ""}/>
                <label for="git-view-changes"><span>Changes</span></label>
                <input id="git-view-history" type="radio" name="git-panel-view" value="history" ${active === "history" ? "checked" : ""}/>
                <label for="git-view-history"><span>History</span></label>
                <input id="git-view-branches" type="radio" name="git-panel-view" value="branches" ${active === "branches" ? "checked" : ""}/>
                <label for="git-view-branches"><span>Branches</span></label>
                <input id="git-view-graph" type="radio" name="git-panel-view" value="graph" ${active === "graph" ? "checked" : ""}/>
                <label for="git-view-graph"><span>Graph</span></label>
            </div>
            <div class="git-view">
                ${active === "changes" ? this.renderChanges() : ""}
                ${active === "history" ? this.renderHistory() : ""}
                ${active === "branches" ? this.renderBranches() : ""}
                ${active === "graph" ? this.renderGraph() : ""}
            </div>
        `
    }

    renderChanges() {
        const status = this.state.status

        if (!status) {
            return `<div class="git-empty-state">Git status is not loaded</div>`
        }

        return `
            <div class="git-actions-row">
                <button class="git-button" data-action="stage-all">Stage All</button>
                <button class="git-button" data-action="unstage-all">Unstage All</button>
            </div>
            ${status.isClean ? `
                <div class="git-clean-state">
                    <span class="git-status-dot clean"></span>
                    <span>Working tree clean</span>
                </div>
            ` : ""}
            ${GROUPS.map(group => this.renderGroup(group, status.groups[group.id] || [])).join("")}
            ${this.renderCommitBox(status)}
        `
    }

    renderGroup(group, files) {
        return `
            <section class="git-change-group">
                <div class="git-change-group__header">
                    <div>
                        <span class="material-symbols-rounded outline">${group.icon}</span>
                        <span>${group.title}</span>
                        <span class="git-count">${files.length}</span>
                    </div>
                </div>
                <div class="git-change-group__body">
                    ${files.length
                        ? files.map(file => this.renderFileRow(file, group.id)).join("")
                        : `<div class="git-group-empty">${group.empty}</div>`}
                </div>
            </section>
        `
    }

    renderFileRow(file, group) {
        const primaryAction = group === "staged" ? "unstage" : "stage"
        const primaryIcon = group === "staged" ? "remove_done" : "add_task"
        const primaryTitle = group === "staged" ? "Unstage file" : "Stage file"

        return `
            <div class="git-file-row" data-path="${escapeHtml(file.path)}" data-group="${group}" data-type="${escapeHtml(file.type)}" data-untracked="${file.untracked ? "true" : "false"}">
                <button class="git-file-row__main" data-action="diff-file">
                    <span class="git-status-dot ${statusClass(file)}"></span>
                    <span class="git-file-row__text">
                        <span class="git-file-row__name">${escapeHtml(fileName(file.path))}</span>
                        <span class="git-file-row__dir">${escapeHtml(dirname(file.path))}</span>
                    </span>
                    <span class="git-status-label ${statusClass(file)}">${escapeHtml(statusLabel(file))}</span>
                </button>
                <div class="git-file-row__actions">
                    ${renderButton(primaryAction, primaryIcon, primaryTitle)}
                    ${renderButton("discard-file", "undo", "Discard changes")}
                </div>
            </div>
        `
    }

    renderCommitBox(status) {
        const staged = status.groups.staged || []

        return `
            <section class="git-commit-box">
                <div class="git-commit-box__title">
                    <span>Commit</span>
                    <span>${staged.length} staged</span>
                </div>
                <textarea id="gitCommitMessage" placeholder="Commit message"></textarea>
                <button class="git-button primary" data-action="commit">Commit</button>
            </section>
        `
    }

    renderHistory() {
        const log = this.state.log

        if (!log) {
            return `<button class="git-button" data-action="load-history">Load history</button>`
        }

        return `
            <div class="git-actions-row">
                <button class="git-button" data-action="load-more-history">Load More</button>
            </div>
            <div class="git-history-list">
                ${log.commits.map(commit => `
                    <article class="git-commit-row" data-hash="${commit.fullHash}">
                        <button class="git-commit-row__main" data-action="commit-diff">
                            <span class="git-commit-row__message">${escapeHtml(commit.message)}</span>
                            <span class="git-commit-row__meta">${escapeHtml(commit.shortHash)} · ${escapeHtml(commit.author)} · ${escapeHtml(shortDate(commit.date))}</span>
                            <span class="git-ref-row">
                                ${commit.branchLabels.map(label => `<span class="git-ref-label branch">${escapeHtml(label)}</span>`).join("")}
                                ${commit.remoteLabels.map(label => `<span class="git-ref-label remote">${escapeHtml(label)}</span>`).join("")}
                                ${commit.tags.map(label => `<span class="git-ref-label tag">${escapeHtml(label)}</span>`).join("")}
                            </span>
                        </button>
                        <div class="git-commit-files">
                            ${commit.files.slice(0, 8).map(file => `
                                <button data-action="commit-file-diff" data-path="${escapeHtml(file.path)}">
                                    <span class="git-status-label">${escapeHtml(file.status)}</span>
                                    <span>${escapeHtml(file.path)}</span>
                                </button>
                            `).join("")}
                            ${commit.files.length > 8 ? `<span class="git-commit-files__more">+${commit.files.length - 8} files</span>` : ""}
                        </div>
                    </article>
                `).join("")}
            </div>
        `
    }

    renderBranches() {
        const branches = this.state.branches

        if (!branches) {
            return `<div class="git-empty-state">Branches are not loaded</div>`
        }

        return `
            <section class="git-branch-create">
                <input id="gitNewBranchName" placeholder="New branch name">
                <button class="git-button" data-action="create-branch">Create</button>
            </section>
            <section class="git-branch-section">
                <h3>Local Branches</h3>
                ${branches.local.map(branch => this.renderBranchRow(branch)).join("") || `<div class="git-group-empty">No local branches</div>`}
            </section>
            <section class="git-branch-section">
                <h3>Remote Branches</h3>
                ${branches.remote.map(branch => this.renderBranchRow(branch, true)).join("") || `<div class="git-group-empty">No remote branches</div>`}
            </section>
        `
    }

    renderBranchRow(branch, remote = false) {
        return `
            <div class="git-branch-row ${branch.current ? "current" : ""}" data-branch="${escapeHtml(branch.name)}" data-remote="${remote ? "true" : "false"}">
                <div class="git-branch-row__main">
                    <span class="material-symbols-rounded outline">${branch.current ? "radio_button_checked" : "account_tree"}</span>
                    <span>
                        <span class="git-branch-row__name">${escapeHtml(branch.name)}</span>
                        <span class="git-branch-row__meta">${branch.upstream ? escapeHtml(branch.upstream) : escapeHtml(branch.hash || "")}</span>
                    </span>
                </div>
                <div class="git-branch-row__actions">
                    ${renderButton("checkout-branch", "login", "Checkout branch", remote ? "disabled" : "")}
                    ${renderButton("merge-branch", "call_merge", "Merge into current branch")}
                    ${renderButton("rebase-branch", "fork_right", "Rebase current branch onto this branch")}
                    ${remote ? "" : renderButton("rename-branch", "drive_file_rename_outline", "Rename branch")}
                    ${remote ? "" : renderButton("delete-branch", "delete", "Delete branch")}
                </div>
            </div>
        `
    }

    renderGraph() {
        return `
            <div class="git-actions-row">
                <button class="git-button" data-action="reload-graph">Reload Graph</button>
            </div>
            <div class="git-graph-host">
                ${this.state.graph ? "" : `<button class="git-button" data-action="load-graph">Load graph</button>`}
            </div>
        `
    }

    async handleAction(action, el) {
        try {
            if (action === "refresh") return await this.refresh()
            if (action === "stage-all") return await this.runAndRefresh(() => window.electron.gitStageAll(this.rootPath), "All files staged")
            if (action === "unstage-all") return await this.runAndRefresh(() => window.electron.gitUnstageAll(this.rootPath), "All files unstaged")
            if (action === "fetch") return await this.runNetworkAction("fetch")
            if (action === "pull") return await this.pull()
            if (action === "push") return await this.runNetworkAction("push")
            if (action === "blame") return await this.blameOverlay.toggle()
            if (action === "commit") return await this.commit()
            if (action === "load-history") return await this.loadHistory()
            if (action === "load-more-history") return await this.loadHistory((this.state.log?.limit || 300) + 200)
            if (action === "load-graph" || action === "reload-graph") return await this.loadGraph()
            if (action === "create-branch") return await this.createBranch()

            const fileRow = el.closest(".git-file-row")
            if (fileRow) return await this.handleFileAction(action, fileRow)

            const commitRow = el.closest(".git-commit-row")
            if (commitRow) return await this.handleCommitAction(action, commitRow, el)

            const branchRow = el.closest(".git-branch-row")
            if (branchRow) return await this.handleBranchAction(action, branchRow)
        } catch (error) {
            notify("Git error", error.message, "error")
        }
    }

    async runAndRefresh(fn, successMessage) {
        try {
            this.setLoading(true)
            ensure(await fn())
            notify("Git", successMessage)
            this.state.log = null
            this.state.graph = null
            await this.refresh()
        } finally {
            this.setLoading(false)
        }
    }

    async runNetworkAction(type) {
        try {
            this.setLoading(true, `${type[0].toUpperCase()}${type.slice(1)} in progress...`)
            const api = {
                fetch: window.electron.gitFetch,
                push: window.electron.gitPush
            }[type]
            const result = ensure(await api(this.rootPath))
            notify(`Git ${type}`, String(result || "Done"))
            await this.refresh()
        } finally {
            this.setLoading(false)
        }
    }

    async pull() {
        const hasChanges = ensure(await window.electron.gitHasChanges(this.rootPath))
        if (hasChanges) {
            const confirmed = window.confirm("There are uncommitted changes. Pull can create conflicts. Continue?")
            if (!confirmed) return
        }

        try {
            this.setLoading(true, "Pull in progress...")
            const result = ensure(await window.electron.gitPull(this.rootPath))
            notify("Git pull", String(result || "Pull completed"))
            await this.refresh()
        } finally {
            this.setLoading(false)
        }
    }

    async commit() {
        const message = this.root.querySelector("#gitCommitMessage")?.value?.trim()

        if (!message) {
            throw new Error("Commit message cannot be empty")
        }

        try {
            this.setLoading(true, "Creating commit...")
            const result = ensure(await window.electron.gitCommit(this.rootPath, message))
            notify("Git commit", result.output || "Commit created")
            this.state.status = result.status
            this.state.log = null
            this.state.graph = null
            await this.refresh()
        } finally {
            this.setLoading(false)
        }
    }

    async handleFileAction(action, row) {
        const filePath = row.dataset.path
        const group = row.dataset.group
        const untracked = row.dataset.untracked === "true"

        if (action === "diff-file") {
            const diff = ensure(await window.electron.gitDiff(this.rootPath, {
                path: filePath,
                cached: group === "staged",
                untracked
            }))
            showGitDiff({ title: `Diff · ${filePath}`, diff })
            return
        }

        if (action === "stage") {
            return await this.runAndRefresh(() => window.electron.gitStage(this.rootPath, filePath), `${filePath} staged`)
        }

        if (action === "unstage") {
            return await this.runAndRefresh(() => window.electron.gitUnstage(this.rootPath, filePath), `${filePath} unstaged`)
        }

        if (action === "discard-file") {
            const confirmed = window.confirm(`Discard changes in ${filePath}? This cannot be undone.`)
            if (!confirmed) return
            return await this.runAndRefresh(() => window.electron.gitDiscard(this.rootPath, filePath, { untracked }), `${filePath} restored`)
        }

        if (action === "restore-file") {
            const confirmed = window.confirm(`Restore ${filePath} from HEAD? Staged and unstaged changes will be lost.`)
            if (!confirmed) return
            return await this.runAndRefresh(() => window.electron.gitRestore(this.rootPath, filePath), `${filePath} restored`)
        }
    }

    async handleCommitAction(action, row, actionEl) {
        const hash = row.dataset.hash

        if (action === "commit-diff") {
            await this.openCommitDiff(hash)
        }

        if (action === "commit-file-diff") {
            const filePath = actionEl.dataset.path
            const diff = ensure(await window.electron.gitCommitDiff(this.rootPath, { commit: hash, path: filePath }))
            showGitDiff({ title: `${hash.slice(0, 8)} · ${filePath}`, diff })
        }
    }

    async openCommitDiff(hash) {
        const diff = ensure(await window.electron.gitCommitDiff(this.rootPath, { commit: hash }))
        showGitDiff({ title: `Commit ${hash.slice(0, 8)}`, diff })
    }

    async handleBranchAction(action, row) {
        const branch = row.dataset.branch

        if (action === "checkout-branch") {
            return await this.runAndRefresh(() => window.electron.gitCheckout(this.rootPath, branch), `Checked out ${branch}`)
        }

        if (action === "merge-branch") {
            const confirmed = window.confirm(`Merge ${branch} into current branch?`)
            if (!confirmed) return
            const result = ensure(await window.electron.gitMerge(this.rootPath, branch))
            notify(result.conflicted ? "Merge conflicts" : "Merge completed", result.output || "")
            await this.refresh()
        }

        if (action === "rebase-branch") {
            const confirmed = window.confirm(`Rebase current branch onto ${branch}?`)
            if (!confirmed) return
            const result = ensure(await window.electron.gitRebase(this.rootPath, branch))
            notify(result.conflicted ? "Rebase conflicts" : "Rebase completed", result.output || "")
            await this.refresh()
        }

        if (action === "delete-branch") {
            const confirmed = window.confirm(`Delete local branch ${branch}?`)
            if (!confirmed) return
            return await this.runAndRefresh(() => window.electron.gitDeleteBranch(this.rootPath, branch), `${branch} deleted`)
        }

        if (action === "rename-branch") {
            const nextName = window.prompt("New branch name", branch)
            if (!nextName || nextName === branch) return
            return await this.runAndRefresh(() => window.electron.gitRenameBranch(this.rootPath, branch, nextName), `${branch} renamed`)
        }
    }

    async createBranch() {
        const input = this.root.querySelector("#gitNewBranchName")
        const branch = input?.value?.trim()
        if (!branch) throw new Error("Branch name cannot be empty")

        await this.runAndRefresh(() => window.electron.gitCreateBranch(this.rootPath, branch, true), `${branch} created`)
    }

    showFileMenu(event, fileEl) {
        const group = fileEl.dataset.group
        const filePath = fileEl.dataset.path
        const untracked = fileEl.dataset.untracked === "true"

        this.contextMenu.show(event, [
            { id: "diff", label: "Open Diff", icon: "difference", action: () => this.handleFileAction("diff-file", fileEl) },
            { type: "divider" },
            group === "staged"
                ? { id: "unstage", label: "Unstage File", icon: "remove_done", action: () => this.handleFileAction("unstage", fileEl) }
                : { id: "stage", label: "Stage File", icon: "add_task", action: () => this.handleFileAction("stage", fileEl) },
            { id: "discard", label: untracked ? "Delete Untracked File" : "Discard Changes", icon: "undo", action: () => this.handleFileAction("discard-file", fileEl) },
            { id: "restore", label: "Restore File", icon: "settings_backup_restore", disabled: untracked, action: () => this.handleFileAction("restore-file", fileEl) },
            { type: "divider" },
            { id: "copy", label: "Copy Relative Path", icon: "content_copy", action: () => navigator.clipboard.writeText(filePath) }
        ])
    }

    showCommitMenu(event, commitEl) {
        const hash = commitEl.dataset.hash

        this.contextMenu.show(event, [
            { id: "diff", label: "Open Commit Diff", icon: "difference", action: () => this.openCommitDiff(hash) },
            { id: "copy", label: "Copy Commit Hash", icon: "content_copy", action: () => navigator.clipboard.writeText(hash) }
        ])
    }

    showBranchMenu(event, branchEl) {
        const branch = branchEl.dataset.branch
        const remote = branchEl.dataset.remote === "true"

        this.contextMenu.show(event, [
            { id: "checkout", label: "Checkout", icon: "login", disabled: remote, action: () => this.handleBranchAction("checkout-branch", branchEl) },
            { id: "merge", label: "Merge Into Current", icon: "call_merge", action: () => this.handleBranchAction("merge-branch", branchEl) },
            { id: "rebase", label: "Rebase Current Onto This", icon: "fork_right", action: () => this.handleBranchAction("rebase-branch", branchEl) },
            { type: "divider" },
            { id: "rename", label: "Rename", icon: "drive_file_rename_outline", disabled: remote, action: () => this.handleBranchAction("rename-branch", branchEl) },
            { id: "delete", label: "Delete", icon: "delete", disabled: remote, action: () => this.handleBranchAction("delete-branch", branchEl) },
            { type: "divider" },
            { id: "copy", label: "Copy Branch Name", icon: "content_copy", action: () => navigator.clipboard.writeText(branch) }
        ])
    }
}

export function initGitPanel(options) {
    return new GitPanel(options)
}
