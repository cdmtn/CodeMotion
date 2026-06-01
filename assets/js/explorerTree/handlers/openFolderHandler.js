import { closeAllTabs } from "../tabHandler.js";
import { buildTreeHtml, renderNodes } from "../render.js";
import { bindFileClicks } from "./bindFileClicksHandler.js";
import { tabsByPath, recentlyClosed } from "../tabHandler.js";
import { initializeExplorerContextMenu } from "./contextMenuHandler.js";

async function setProjectDataUsedLanguages(path) {
    const usedLanguages = await window.electron.getUsedLanguagesByPath(path)
    const unknownPercentage = usedLanguages.unknown.percentage

    const graph = document.querySelector("#project_analys_graphic")
    const graphItems = document.querySelector("#project_analys_graphic_items")

    graph.innerHTML = ""
    graphItems.innerHTML = ""

    document.querySelector("#project_analys_files").textContent = usedLanguages.totalFiles
    document.querySelector("#project_analys_path").textContent = path

    function createGraphElement({ name, perc, color }) {
        const languageGraphLine = document.createElement("div")
        languageGraphLine.classList.add("column-element__linear-graphic__element")
        languageGraphLine.style.width = perc + "%"
        languageGraphLine.id = name
        languageGraphLine.style.background = color

        graph.appendChild(languageGraphLine)

        const languageGraphItem = document.createElement("div")
        languageGraphItem.classList.add("column-element-linear-graphic__items-item")
        languageGraphItem.innerHTML = `
            <div class="column-element-linear-graphic__items-item__color" style="background:${color}"></div>
            <div class="column-element-linear-graphic__items-item__name">${name}</div>
            <div class="column-element-linear-graphic__items-item__perc">${perc}%</div>
        `

        graphItems.appendChild(languageGraphItem)
    }

    usedLanguages.languages.forEach(key => {
        const languageName = key.name
        const languagePercentage = key.percentage
        const languageColor = key.color

        console.log(languageColor)

        if(languagePercentage != 0) {
            createGraphElement({ name: languageName, perc: languagePercentage, color: languageColor })
        }
    })

    createGraphElement({ name: "Unknown", perc: unknownPercentage, color: "#4747478f" })
}

export async function openFolder({ pathRoot, filesPanel, addToHistory, pathContext, settings }) {
    setProjectDataUsedLanguages(pathRoot)

    closeAllTabs();
    
    if (!filesPanel) {
        console.warn("Files panel not found");
        return;
    }

    try {
        filesPanel.innerHTML = await buildTreeHtml(pathRoot);

        updatePathContext(
            {
                pathRoot: pathRoot,
                pathContext: pathContext
            }
        );
        updateTabName(pathContext);

        bindFileClicks(
            {
                scopeEl: filesPanel,
                tabsByPath: tabsByPath,
                recentlyClosed: recentlyClosed,
                pathContext: pathContext,
                settings: settings
            }
        );

        addToHistory(
            {
                actionType: "created",
                value: "Project created",
                desc: `Project in ${pathRoot} created. Now you can edit and create files`
            }
        );

        initializeFolderToggle(filesPanel, { pathContext, settings });
        initializeExplorerContextMenu(filesPanel, { tabsByPath, recentlyClosed, pathContext, settings });

    } catch (error) {
        console.error("Error opening folder:", error);

        addToHistory(
            {
                actionType: "error",
                value: "Failed to open project",
                desc: error.message
            }
        );
    }
}

function updatePathContext({ pathRoot, pathContext }) {
    const parts = pathRoot.split(/\\/g);
    pathContext["rootPath"] = parts.join("/");
    pathContext["root"] = parts.pop();
}

function updateTabName(pathContext) {
    const tabElement = document.querySelector("#tab-name");
    if (tabElement) {
        tabElement.textContent = pathContext.root;
    }
}

export function initializeFolderToggle(container, context = {}) {
    if (container._toggleHandler) {
        container.removeEventListener("click", container._toggleHandler);
    }

    const toggleHandler = async (event) => {
        const dirTitle = event.target.closest(".dir-title");

        if (!dirTitle) return;

        event.stopPropagation();

        const dirElement = dirTitle.closest(".dir");
        
        if (!dirElement) return;

        const isExpanding = !dirElement.classList.contains("expanded");
        dirElement.classList.toggle("expanded", isExpanding);

        if (!isExpanding || dirElement.dataset.loaded !== "false" || dirElement.dataset.loading === "true") {
            return;
        }

        dirElement.dataset.loading = "true";
        const content = Array.from(dirElement.children).find(child => child.classList.contains("dir-content"));

        try {
            if (!content) return;

            const children = await window.electron.readDirTree(dirElement.dataset.path, { maxDepth: 0, ignoreRoot: context.pathContext?.rootPath });
            content.innerHTML = await renderNodes(children);
            dirElement.dataset.loaded = "true";

            bindFileClicks(
                {
                    scopeEl: content,
                    tabsByPath: tabsByPath,
                    recentlyClosed: recentlyClosed,
                    pathContext: context.pathContext,
                    settings: context.settings
                }
            );
        } catch (error) {
            console.error("Error loading folder:", error);
        } finally {
            delete dirElement.dataset.loading;
        }
    };

    container._toggleHandler = toggleHandler;
    container.addEventListener("click", toggleHandler);
}

function initializeFolderToggleLegible(container) {
    if (container._toggleHandler) {
        container.removeEventListener("click", container._toggleHandler);
    }

    const toggleHandler = (event) => {
        const folderIcon = event.target.closest(".folder-icon");
        const fileName = event.target.closest(".dir-title .file");

        if (!folderIcon && !fileName) return;

        event.stopPropagation();

        const dirElement = event.currentTarget.querySelector(".dir");
        if (dirElement) {
            dirElement.classList.toggle("expanded");
        }
    };

    container._toggleHandler = toggleHandler;
    container.addEventListener("click", toggleHandler);
}