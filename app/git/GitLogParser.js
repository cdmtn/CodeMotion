const FIELD = "\x1f"
const RECORD = "\x1e"

function parseRefs(refText = "") {
    const refs = refText
        .split(",")
        .map(ref => ref.trim())
        .filter(Boolean)

    const branches = []
    const remotes = []
    const tags = []
    let head = false

    refs.forEach(ref => {
        if (ref.startsWith("HEAD -> ")) {
            head = true
            branches.push(ref.slice("HEAD -> ".length))
            return
        }

        if (ref === "HEAD") {
            head = true
            return
        }

        if (ref.startsWith("tag: ")) {
            tags.push(ref.slice("tag: ".length))
            return
        }

        if (ref.includes("/")) {
            remotes.push(ref)
        } else {
            branches.push(ref)
        }
    })

    return {
        refs,
        branches,
        remotes,
        tags,
        head
    }
}

function parseNameStatus(lines) {
    return lines
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const parts = line.split("\t")
            const status = parts.shift()

            return {
                status,
                path: parts[parts.length - 1] || "",
                originalPath: parts.length > 1 ? parts[0] : null
            }
        })
        .filter(file => file.path)
}

function parseLog(raw) {
    return raw
        .split(RECORD)
        .map(chunk => chunk.trim())
        .filter(Boolean)
        .map(chunk => {
            const lines = chunk.split(/\r?\n/)
            const fields = lines.shift().split(FIELD)
            const refs = parseRefs(fields[6] || "")

            return {
                fullHash: fields[0],
                shortHash: fields[0]?.slice(0, 8),
                parents: fields[1] ? fields[1].split(" ").filter(Boolean) : [],
                author: fields[2],
                email: fields[3],
                date: fields[4],
                message: fields[5] || "",
                refs: refs.refs,
                branchLabels: refs.branches,
                remoteLabels: refs.remotes,
                tags: refs.tags,
                isHead: refs.head,
                files: parseNameStatus(lines)
            }
        })
}

module.exports = {
    FIELD,
    RECORD,
    parseRefs,
    parseLog,
    parseNameStatus
}
