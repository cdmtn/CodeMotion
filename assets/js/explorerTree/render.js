import { escapeHtml } from "../lib.js";
import { getFileIconUrl, getFolderIconUrl } from "../iconRegistry.js";

function createFileElement(node, ext, fileIcon) {
    return `
        <div class="file${node.ignored ? " ignored" : ""}" data-path="${node.escapedPath}" data-extension="${ext}" data-name="${node.escapedName}" data-ignored="${node.ignored ? "true" : "false"}">
            <img class="file-icon" src="${fileIcon}" alt="${ext} icon">
            <span class="explorer-name">${node.escapedName}</span>
        </div>`;
}

function createDirElement(node, icon, childrenHtml, loaded, expanded = false) {
    return `
        <div class="dir${node.ignored ? " ignored" : ""}${expanded ? " expanded" : ""}" data-path="${node.escapedPath}" data-loaded="${loaded ? "true" : "false"}" data-ignored="${node.ignored ? "true" : "false"}">
            <div class="dir-title">
                <img class="folder-icon" src="${icon}" alt="folder icon">
                <span class="explorer-name">${node.escapedName}</span>
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

/**
 * Reads a directory tree from root path and generates corresponding HTML structure.
 * @param {string} rootPath - Absolute path of the root directory.
 * @returns {Promise<string>} Rendered HTML string of the file tree.
 */
export async function buildTreeHtml(rootPath) {
    const nodes = await window.electron.readDirTree(rootPath, { maxDepth: 0, ignoreRoot: rootPath });
    return renderNodes(nodes);
}

/**
 * Recursively converts tree node data objects into HTML file/folder elements with dynamic SVG icons.
 * @param {Array<Object>} nodes - List of file tree node descriptors.
 * @returns {Promise<string>} Generated HTML string for the current directory level.
 */
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
                    const fileIcon = getFileIconUrl(normalized.escapedName);

                    html = createFileElement(normalized, ext, fileIcon);
                    break;
                }
                case "dir": {
                    const loaded = node.loaded !== false;
                    const children = loaded && Array.isArray(node.children) ? node.children : [];
                    const icon = getFolderIconUrl(normalized.escapedName, false);
                    const childrenHtml = await renderNodes(children);

                    html = createDirElement(normalized, icon, childrenHtml, loaded);
                    break;
                }
                case "symlink": {
                    const icon = getFolderIconUrl(normalized.escapedName, false);
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