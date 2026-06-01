import { Languages, Dirs, escapeHtml, Filenames } from "../lib.js";

const iconCache = new Map();

async function getFileIcon({ ext, name }) {
    const nameKey = `name:${name}`;
    const extKey = `ext:${ext}`;

    if (iconCache.has(nameKey)) {
        return iconCache.get(nameKey);
    }

    const fileNameIcon = await Filenames.getIconPath(name);

    if (fileNameIcon) {
        iconCache.set(nameKey, fileNameIcon);
        return fileNameIcon;
    }

    if (iconCache.has(extKey)) {
        return iconCache.get(extKey);
    }

    const fileIcon = await Languages.getIconPath(ext);

    iconCache.set(extKey, fileIcon);

    return fileIcon;
}

function getDirIcon(name) {
    return Dirs.getIcon(name);
}

function createFileElement(node, ext, fileIcon) {
    return `
        <div class="file${node.ignored ? " ignored" : ""}" data-path="${node.escapedPath}" data-extension="${ext}" data-name="${node.escapedName}" data-ignored="${node.ignored ? "true" : "false"}">
            <img class="file-icon" src="${fileIcon}" alt="${ext} icon">
            <span class="explorer-name">${node.escapedName}</span>
        </div>`;
}

function createDirElement(node, icon, childrenHtml, loaded) {
    return `
        <div class="dir${node.ignored ? " ignored" : ""}" data-path="${node.escapedPath}" data-loaded="${loaded ? "true" : "false"}" data-ignored="${node.ignored ? "true" : "false"}">
            <div class="dir-title">
                <img class="folder-icon" src="${icon}" alt="folder icon">
                <div class="file"><span class="explorer-name">${node.escapedName}</span></div>
            </div>
            <div class="dir-content">
                ${childrenHtml}
            </div>
        </div>`;
}

function createSymlinkElement(node, icon) {
    return `
        <div class="file symlink${node.ignored ? " ignored" : ""}" data-path="${node.escapedPath}" data-ignored="${node.ignored ? "true" : "false"}">
            <img class="folder-icon" src="${icon}" alt="symlink icon">
            <span class="explorer-name">${node.escapedName}</span>
        </div>`;
}

function normalizeNode(node) {
    return {
        ...node,
        escapedName: escapeHtml(node.name),
        escapedPath: escapeHtml(node.path)
    };
}

export async function buildTreeHtml(rootPath) {
    const nodes = await window.electron.readDirTree(rootPath, { maxDepth: 0, ignoreRoot: rootPath });
    return renderNodes(nodes);
}

export async function renderNodes(nodes) {
    if (!Array.isArray(nodes) || nodes.length === 0) {
        return "";
    }

    const htmlParts = [];

    for (const node of nodes) {
        const normalized = normalizeNode(node);
        let html = "";

        try {
            switch (node.type) {
                case "file": {
                    const ext = normalized.escapedName.split(".").pop();
                    const fileIcon = await getFileIcon({ ext: ext, name: normalized.escapedName });

                    html = createFileElement(normalized, ext, fileIcon);
                    break;
                }
                case "dir": {
                    const loaded = node.loaded !== false;
                    const children = loaded && Array.isArray(node.children) ? node.children : [];
                    const icon = getDirIcon(normalized.escapedName);
                    const childrenHtml = await renderNodes(children);

                    html = createDirElement(normalized, icon, childrenHtml, loaded);
                    break;
                }
                case "symlink": {
                    const icon = getDirIcon(normalized.escapedName);
                    html = createSymlinkElement(normalized, icon);
                    break;
                }
                default:
                    console.warn(`Unknown node type: ${node.type}`);
            }

            if (html) {
                htmlParts.push(html);
            }
        } catch (error) {
            console.error(`Error rendering node ${node.path}:`, error);
        }
    }

    return htmlParts.join("");
}