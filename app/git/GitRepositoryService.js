const fs = require("fs")
const path = require("path")
const { runGit, assertGitAvailable, getRepositoryRoot } = require("./GitCommandRunner.js")
const { parseStatusV2 } = require("./GitStatusParser.js")
const { FIELD, RECORD, parseLog } = require("./GitLogParser.js")
const { buildGraph, parseDecoratedLog } = require("./GitGraphBuilder.js")
const { getWorkingTreeDiff, getCommitDiff } = require("./GitDiffService.js")

function cleanLimit(limit, fallback = 300) {
    const number = Number(limit)
    if (!Number.isInteger(number)) return fallback
    return Math.min(Math.max(number, 20), 1000)
}

function ok(result) {
    return { success: true, result }
}

function fail(error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
}

function ensurePath(root, filePath) {
    if (!filePath || typeof filePath !== "string") {
        throw new Error("Invalid file path")
    }

    const normalized = filePath.replace(/\\/g, "/")
    const abs = path.resolve(root, normalized)
    const resolvedRoot = path.resolve(root)

    if (!abs.startsWith(resolvedRoot)) {
        throw new Error("Path is outside Git repository")
    }

    return normalized
}

class GitRepositoryService {
    async resolveRoot(rootPath) {
        await assertGitAvailable(rootPath || process.cwd())
        return getRepositoryRoot(rootPath || process.cwd())
    }

    async status(rootPath) {
        const root = await this.resolveRoot(rootPath)
        const result = await runGit(root, ["status", "--porcelain=v2", "-z", "--branch", "--untracked-files=all"])

        if (!result.success) {
            throw new Error(result.error || "Could not read Git status")
        }

        return {
            root,
            ...parseStatusV2(result.stdout)
        }
    }

    async hasUncommittedChanges(rootPath) {
        const status = await this.status(rootPath)
        return !status.isClean
    }

    async stage(rootPath, filePath) {
        const root = await this.resolveRoot(rootPath)
        const target = ensurePath(root, filePath)
        const result = await runGit(root, ["add", "--", target])
        if (!result.success) throw new Error(result.error || "Could not stage file")
        return this.status(root)
    }

    async unstage(rootPath, filePath) {
        const root = await this.resolveRoot(rootPath)
        const target = ensurePath(root, filePath)
        let result = await runGit(root, ["restore", "--staged", "--", target], { allowFailure: true })

        if (!result.success) {
            result = await runGit(root, ["reset", "HEAD", "--", target], { allowFailure: true })
        }

        if (!result.success) throw new Error(result.error || "Could not unstage file")
        return this.status(root)
    }

    async stageAll(rootPath) {
        const root = await this.resolveRoot(rootPath)
        const result = await runGit(root, ["add", "-A"])
        if (!result.success) throw new Error(result.error || "Could not stage all files")
        return this.status(root)
    }

    async unstageAll(rootPath) {
        const root = await this.resolveRoot(rootPath)
        let result = await runGit(root, ["restore", "--staged", "."], { allowFailure: true })

        if (!result.success) {
            result = await runGit(root, ["reset", "HEAD"], { allowFailure: true })
        }

        if (!result.success) throw new Error(result.error || "Could not unstage files")
        return this.status(root)
    }

    async discard(rootPath, filePath, options = {}) {
        const root = await this.resolveRoot(rootPath)
        const target = ensurePath(root, filePath)
        let result

        if (options.untracked) {
            result = await runGit(root, ["clean", "-f", "--", target], { allowFailure: true })
        } else {
            result = await runGit(root, ["restore", "--worktree", "--", target], { allowFailure: true })
        }

        if (!result.success) throw new Error(result.error || "Could not discard changes")
        return this.status(root)
    }

    async restore(rootPath, filePath) {
        const root = await this.resolveRoot(rootPath)
        const target = ensurePath(root, filePath)
        const result = await runGit(root, ["restore", "--source=HEAD", "--staged", "--worktree", "--", target], { allowFailure: true })
        if (!result.success) throw new Error(result.error || "Could not restore file")
        return this.status(root)
    }

    async commit(rootPath, message) {
        const root = await this.resolveRoot(rootPath)
        const cleanMessage = String(message || "").trim()

        if (!cleanMessage) {
            throw new Error("Commit message cannot be empty")
        }

        const status = await this.status(root)
        if (status.counts.staged === 0) {
            throw new Error("There are no staged files to commit")
        }

        const result = await runGit(root, ["commit", "-m", cleanMessage], { timeout: 60000, maxBuffer: 1024 * 1024 * 8 })
        if (!result.success) throw new Error(result.error || "Commit failed")

        return {
            output: result.stdout || result.stderr,
            status: await this.status(root)
        }
    }

    async diff(rootPath, options = {}) {
        const root = await this.resolveRoot(rootPath)
        if (options.path) ensurePath(root, options.path)

        return getWorkingTreeDiff(root, options)
    }

    async commitDiff(rootPath, options = {}) {
        const root = await this.resolveRoot(rootPath)
        if (!options.commit) throw new Error("Missing commit hash")
        if (options.path) ensurePath(root, options.path)

        return getCommitDiff(root, options)
    }

    async log(rootPath, limit = 300) {
        const root = await this.resolveRoot(rootPath)
        const safeLimit = cleanLimit(limit)
        const format = `${RECORD}%H${FIELD}%P${FIELD}%an${FIELD}%ae${FIELD}%ad${FIELD}%s${FIELD}%D`

        const result = await runGit(root, [
            "log",
            "--all",
            "--date=iso-strict",
            "--find-renames",
            `--max-count=${safeLimit}`,
            `--pretty=format:${format}`,
            "--name-status"
        ], { maxBuffer: 1024 * 1024 * 32 })

        if (!result.success) throw new Error(result.error || "Could not read Git history")

        return {
            root,
            limit: safeLimit,
            commits: parseLog(result.stdout)
        }
    }

    async graph(rootPath, limit = 400) {
        const root = await this.resolveRoot(rootPath)
        const safeLimit = cleanLimit(limit, 400)
        const format = `${RECORD}%H${FIELD}%P${FIELD}%an${FIELD}%ad${FIELD}%s${FIELD}%D`

        const result = await runGit(root, [
            "log",
            "--all",
            "--topo-order",
            "--date=iso-strict",
            `--max-count=${safeLimit}`,
            `--pretty=format:${format}`
        ], { maxBuffer: 1024 * 1024 * 20 })

        if (!result.success) throw new Error(result.error || "Could not build Git graph")

        return {
            root,
            limit: safeLimit,
            ...buildGraph(parseDecoratedLog(result.stdout))
        }
    }

    async branches(rootPath) {
        const root = await this.resolveRoot(rootPath)
        const format = "%(refname:short)%00%(objectname:short)%00%(upstream:short)%00%(HEAD)%00%(committerdate:iso-strict)"
        const local = await runGit(root, ["branch", "--format", format, "--sort=-committerdate"])
        const remote = await runGit(root, ["branch", "-r", "--format", format, "--sort=-committerdate"], { allowFailure: true })
        const status = await this.status(root)

        if (!local.success) throw new Error(local.error || "Could not read local branches")

        function parse(raw, type) {
            return raw
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean)
                .map(line => {
                    const [name, hash, upstream, head, date] = line.split("\0")
                    return {
                        name,
                        hash,
                        upstream: upstream || null,
                        current: head === "*",
                        date,
                        type
                    }
                })
        }

        return {
            root,
            current: status.branch.current,
            upstream: status.branch.upstream,
            ahead: status.branch.ahead,
            behind: status.branch.behind,
            local: parse(local.stdout, "local"),
            remote: remote.success ? parse(remote.stdout, "remote") : []
        }
    }

    async checkout(rootPath, branch) {
        const root = await this.resolveRoot(rootPath)
        const result = await runGit(root, ["checkout", branch])
        if (!result.success) throw new Error(result.error || "Checkout failed")
        return this.branches(root)
    }

    async createBranch(rootPath, branch, checkout = true) {
        const root = await this.resolveRoot(rootPath)
        const cleanName = String(branch || "").trim()
        if (!cleanName) throw new Error("Branch name cannot be empty")

        const args = checkout ? ["checkout", "-b", cleanName] : ["branch", cleanName]
        const result = await runGit(root, args)
        if (!result.success) throw new Error(result.error || "Could not create branch")
        return this.branches(root)
    }

    async deleteBranch(rootPath, branch) {
        const root = await this.resolveRoot(rootPath)
        const result = await runGit(root, ["branch", "-d", branch], { allowFailure: true })
        if (!result.success) throw new Error(result.error || "Could not delete branch")
        return this.branches(root)
    }

    async renameBranch(rootPath, oldName, newName) {
        const root = await this.resolveRoot(rootPath)
        const cleanName = String(newName || "").trim()
        if (!cleanName) throw new Error("Branch name cannot be empty")

        const args = oldName ? ["branch", "-m", oldName, cleanName] : ["branch", "-m", cleanName]
        const result = await runGit(root, args)
        if (!result.success) throw new Error(result.error || "Could not rename branch")
        return this.branches(root)
    }

    async fetch(rootPath) {
        const root = await this.resolveRoot(rootPath)
        const result = await runGit(root, ["fetch", "--all", "--prune"], { timeout: 120000, maxBuffer: 1024 * 1024 * 12 })
        if (!result.success) throw new Error(result.error || "Fetch failed")
        return result.stdout || result.stderr || "Fetch completed"
    }

    async pull(rootPath) {
        const root = await this.resolveRoot(rootPath)
        const result = await runGit(root, ["pull"], { timeout: 120000, maxBuffer: 1024 * 1024 * 12 })
        if (!result.success) throw new Error(result.error || "Pull failed")
        return result.stdout || result.stderr || "Pull completed"
    }

    async push(rootPath, currentOnly = true) {
        const root = await this.resolveRoot(rootPath)
        const args = currentOnly ? ["push"] : ["push", "--all"]
        const result = await runGit(root, args, { timeout: 120000, maxBuffer: 1024 * 1024 * 12 })
        if (!result.success) throw new Error(result.error || "Push failed")
        return result.stdout || result.stderr || "Push completed"
    }

    async merge(rootPath, branch) {
        const root = await this.resolveRoot(rootPath)
        const result = await runGit(root, ["merge", branch], { timeout: 120000, maxBuffer: 1024 * 1024 * 12, allowFailure: true })
        if (!result.success) {
            return {
                conflicted: true,
                output: result.stdout || result.stderr || result.error,
                status: await this.status(root)
            }
        }
        return { conflicted: false, output: result.stdout || result.stderr, status: await this.status(root) }
    }

    async rebase(rootPath, branch) {
        const root = await this.resolveRoot(rootPath)
        const result = await runGit(root, ["rebase", branch], { timeout: 120000, maxBuffer: 1024 * 1024 * 12, allowFailure: true })
        if (!result.success) {
            return {
                conflicted: true,
                output: result.stdout || result.stderr || result.error,
                status: await this.status(root)
            }
        }
        return { conflicted: false, output: result.stdout || result.stderr, status: await this.status(root) }
    }

    async blame(rootPath, filePath) {
        const root = await this.resolveRoot(rootPath)
        const target = ensurePath(root, filePath)
        const abs = path.join(root, target)
        const linesCount = fs.existsSync(abs)
            ? fs.readFileSync(abs, "utf8").split(/\r?\n/).length
            : 0

        const result = await runGit(root, ["blame", "--line-porcelain", "--", target], { allowFailure: true, maxBuffer: 1024 * 1024 * 24 })

        if (!result.success) {
            return {
                path: target,
                lines: Array.from({ length: linesCount }, (_, index) => ({
                    line: index + 1,
                    author: "Uncommitted",
                    shortHash: "00000000",
                    hash: "0000000000000000000000000000000000000000",
                    date: "",
                    summary: "Not committed yet"
                }))
            }
        }

        const lines = []
        let current = null

        result.stdout.split(/\r?\n/).forEach(line => {
            const header = line.match(/^([0-9a-f]{40})\s+\d+\s+(\d+)/)
            if (header) {
                current = {
                    hash: header[1],
                    shortHash: header[1].slice(0, 8),
                    line: Number(header[2]),
                    author: "",
                    authorTime: null,
                    date: "",
                    summary: ""
                }
                return
            }

            if (!current) return

            if (line.startsWith("author ")) current.author = line.slice("author ".length)
            if (line.startsWith("author-time ")) {
                current.authorTime = Number(line.slice("author-time ".length))
                current.date = new Date(current.authorTime * 1000).toISOString().slice(0, 10)
            }
            if (line.startsWith("summary ")) current.summary = line.slice("summary ".length)
            if (line.startsWith("\t")) {
                lines.push(current)
                current = null
            }
        })

        return { path: target, lines }
    }
}

async function handleGitAction(action) {
    try {
        return ok(await action())
    } catch (error) {
        return fail(error)
    }
}

module.exports = {
    GitRepositoryService,
    handleGitAction
}
