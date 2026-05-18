const fs = require("fs")
const path = require("path")
const { runGit } = require("./GitCommandRunner.js")

function parseUnifiedDiff(diffText) {
    if (!diffText || !diffText.trim()) {
        return []
    }

    const files = []
    let currentFile = null
    let oldLine = 0
    let newLine = 0

    diffText.split(/\r?\n/).forEach((line) => {
        if (line.startsWith("diff --git ")) {
            currentFile = {
                header: line,
                oldPath: null,
                newPath: null,
                hunks: [],
                lines: []
            }
            files.push(currentFile)
            return
        }

        if (!currentFile) {
            currentFile = {
                header: "",
                oldPath: null,
                newPath: null,
                hunks: [],
                lines: []
            }
            files.push(currentFile)
        }

        if (line.startsWith("--- ")) {
            currentFile.oldPath = line.slice(4)
            currentFile.lines.push({ type: "meta", content: line, oldLine: null, newLine: null })
            return
        }

        if (line.startsWith("+++ ")) {
            currentFile.newPath = line.slice(4)
            currentFile.lines.push({ type: "meta", content: line, oldLine: null, newLine: null })
            return
        }

        if (line.startsWith("@@")) {
            const match = line.match(/@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/)
            oldLine = match ? Number(match[1]) : 0
            newLine = match ? Number(match[2]) : 0
            currentFile.hunks.push(line)
            currentFile.lines.push({ type: "hunk", content: line, oldLine: null, newLine: null })
            return
        }

        if (line.startsWith("+") && !line.startsWith("+++")) {
            currentFile.lines.push({ type: "added", content: line, oldLine: null, newLine })
            newLine += 1
            return
        }

        if (line.startsWith("-") && !line.startsWith("---")) {
            currentFile.lines.push({ type: "removed", content: line, oldLine, newLine: null })
            oldLine += 1
            return
        }

        if (line.startsWith("\\ No newline")) {
            currentFile.lines.push({ type: "meta", content: line, oldLine: null, newLine: null })
            return
        }

        currentFile.lines.push({
            type: line.startsWith("index ") || line.startsWith("new file ") || line.startsWith("deleted file ") || line.startsWith("similarity ")
                ? "meta"
                : "context",
            content: line,
            oldLine,
            newLine
        })

        if (!line.startsWith("index ") && !line.startsWith("new file ") && !line.startsWith("deleted file ") && !line.startsWith("similarity ")) {
            oldLine += 1
            newLine += 1
        }
    })

    return files
}

function buildUntrackedDiff(root, relativePath) {
    const abs = path.join(root, relativePath)
    const content = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : ""
    const lines = content.split(/\r?\n/)
    const body = lines.map(line => `+${line}`).join("\n")

    return [
        `diff --git a/${relativePath} b/${relativePath}`,
        "new file mode 100644",
        "index 0000000..0000000",
        "--- /dev/null",
        `+++ b/${relativePath}`,
        `@@ -0,0 +1,${lines.length} @@`,
        body
    ].join("\n")
}

async function getWorkingTreeDiff(root, options = {}) {
    const filePath = options.path

    if (options.untracked && filePath) {
        const text = buildUntrackedDiff(root, filePath)
        return { text, files: parseUnifiedDiff(text) }
    }

    const args = ["diff", "--find-renames", "--no-ext-diff", "--unified=80"]
    if (options.cached) args.push("--cached")
    if (filePath) args.push("--", filePath)

    const result = await runGit(root, args, { allowFailure: true })

    if (!result.success && result.code !== 1) {
        throw new Error(result.error || "Could not read diff")
    }

    return {
        text: result.stdout,
        files: parseUnifiedDiff(result.stdout)
    }
}

async function getCommitDiff(root, options = {}) {
    const args = ["show", "--format=", "--find-renames", "--no-ext-diff", "--unified=80", options.commit]

    if (options.path) {
        args.push("--", options.path)
    }

    const result = await runGit(root, args, { allowFailure: true })

    if (!result.success && result.code !== 1) {
        throw new Error(result.error || "Could not read commit diff")
    }

    return {
        text: result.stdout,
        files: parseUnifiedDiff(result.stdout)
    }
}

module.exports = {
    getWorkingTreeDiff,
    getCommitDiff,
    parseUnifiedDiff
}
