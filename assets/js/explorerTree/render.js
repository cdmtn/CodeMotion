import { Languages, Dirs, escapeHtml } from "../lib.js";

const iconCache = new Map();

async function getFileIcon(ext) {
    if (iconCache.has(ext)) {
        return iconCache.get(ext);
    }
    const icon = await Languages.getIconPath(ext);
    iconCache.set(ext, icon);
    return icon;
}

function getDirIcon(name) {
    return Dirs.getIcon(name);
}

function createFileElement(node, ext, fileIcon) {
    return `
        <div class="file" data-path="${node.escapedPath}" data-extension="${ext}" data-name="${node.escapedName}">
            <img class="file-icon" src="${fileIcon}" alt="${ext} icon">
            ${node.escapedName}
        </div>`;
}

function createDirElement(node, icon, childrenHtml, loaded) {
    return `
        <div class="dir" data-path="${node.escapedPath}" data-loaded="${loaded ? "true" : "false"}">
            <div class="dir-title">
                <img class="folder-icon" src="${icon}" alt="folder icon">
                <div class="file">${node.escapedName}</div>
            </div>
            <div class="dir-content">
                ${childrenHtml}
            </div>
        </div>`;
}

function createSymlinkElement(node, icon) {
    return `
        <div class="file symlink" data-path="${node.escapedPath}">
            <img class="folder-icon" src="${icon}" alt="symlink icon">
            ${node.escapedName}
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
    const nodes = await window.electron.readDirTree(rootPath, { maxDepth: 0 });
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
                    const fileIcon = await getFileIcon(ext);
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