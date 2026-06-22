const { dialog } = require("electron")
const fsPromise = require('fs/promises');
const path = require("path")

function selectFile(win) {
    const result = dialog.showOpenDialogSync(win, {
        title: "Choose a file",
        properties: ["openFile"],
    });

    if (!result || !result.length) return null;

    return result[0];
}

function selectFolder(win) {
    const result = dialog.showOpenDialogSync(win, {
        title: "Choose directory",
        properties: ["openDirectory"] 
    });

    if (!result || !result.length) return null;
    return result[0];
}

async function saveFile(fullPath, content) {
    try {
        await fsPromise.writeFile(fullPath, content, 'utf8');
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function readDirTree(rootPath, options = {}) {
    const absRoot = path.resolve(rootPath);
    const maxDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : Infinity;
    const ignoreRoot = path.resolve(options.ignoreRoot || absRoot);
    const ignoreRules = await readIgnoreRules(ignoreRoot);

    async function walk(dir, depth = 0) {
        let entries = [];

        try {
            const dirents = await fsPromise.readdir(dir, { withFileTypes: true });

            for (const d of dirents) {
                const full = path.join(dir, d.name);
                const item = { name: d.name, path: full, ignored: isIgnored(full, d.isDirectory(), ignoreRoot, ignoreRules) };

                if (d.isDirectory()) {
                    if (depth < maxDepth) {
                        const children = await walk(full, depth + 1);
                        entries.push({ ...item, type: 'dir', children, loaded: true });
                    } else {
                        entries.push({ ...item, type: 'dir', loaded: false });
                    }
                } else if (d.isSymbolicLink()) {
                    entries.push({ ...item, type: 'symlink' });
                } else {
                    entries.push({ ...item, type: 'file' });
                }
            }

            entries.sort((a, b) => {
                if (a.type === b.type) {
                    return a.name.localeCompare(b.name) || 0;
                }
                if (a.type === 'dir') return -1;
                if (b.type === 'dir') return 1;
                return 0;
            });

        } catch (err) {
            entries.push({
                name: path.basename(dir),
                path: dir,
                type: 'dir',
                error: String(err),
            });
        }

        return entries;
    }

    try {
        const st = await fsPromise.lstat(absRoot);

        if (st.isFile()) {
            return [{ name: path.basename(absRoot), path: absRoot, type: 'file' }];
        }
    } catch (e) {
        throw new Error(`Path not found: ${absRoot}`);
    }
    
    return walk(absRoot);
}

module.exports = {
    selectFile,
    selectFolder,
    saveFile,
    readDirTree
}

async function readIgnoreRules(rootPath) {
    try {
        const content = await fsPromise.readFile(path.join(rootPath, ".gitignore"), "utf8");
        return content
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line && !line.startsWith("#"))
            .map(line => line.replace(/\\/g, "/"));
    } catch (_) {
        return [];
    }
}

function isIgnored(targetPath, isDir, rootPath, rules) {
    const relative = path.relative(rootPath, targetPath).replace(/\\/g, "/");
    if (!relative || relative.startsWith("..")) return false;

    const name = path.basename(targetPath);

    return rules.some(rule => {
        let pattern = rule;
        let dirOnly = pattern.endsWith("/");

        if (pattern.startsWith("!")) return false;
        pattern = pattern.replace(/^\/+/, "").replace(/\/+$/, "");
        if (!pattern) return false;

        const target = pattern.includes("/") ? relative : name;

        if (dirOnly && !isDir) return false;
        if (target === pattern || relative === pattern || relative.startsWith(`${pattern}/`)) return true;

        if (pattern.includes("*")) {
            const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
            return new RegExp(`^${escaped}$`).test(target);
        }

        return false;
    });
}