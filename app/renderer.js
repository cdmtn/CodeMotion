import {
    escapeHtml,
    addToBug, 
    addToHistory, 
    showIndicator, 
    handlePopups,
    Loader,
    capitilize,
    handleOnWheelScrollX,
    Languages,
    Dirs,
    TopBarElement,
    tabName,
    setTabNameCounter,
    setTabName,
    DragDrop
} from "../assets/js/lib.js"
import { getCurrentUserDataFromAPI, setUserPcInfo } from "../assets/js/user.js"

import * as object from "../assets/js/objects.js"

import { openTab, reopenLastClosed, activateTab, recentlyClosed, tabsByPath, currentPath, currentContent } from "../assets/components/tabHandler.js"
import { handlePopovers } from "../assets/js/handlers/handlePopovers.js"
import { initExtensions } from "../assets/js/extensionsHandler/extensionsHandler.js"
import { sendDebugMsg } from "../assets/js/handlers/debuggerSignalHandlers.js"
import { initActions } from "../assets/js/actions.js"

import { handleHistoryTab } from "../assets/js/explorerTabsHandlers/history.js"
import { handleBugsTab } from "../assets/js/explorerTabsHandlers/bugs.js"
import { getDirname, readSettings } from "../assets/js/global.js"
import { closeAllTabs } from "../assets/components/tabHandler.js"

import { handleSettings } from "../assets/js/settings.js"
import { SidebarResizeHandler } from "../assets/js/handlers/SidebarResizeHandler.js"

import { buildTreeHtml, renderNodes } from "../assets/js/explorerTree/render.js"
import { openFolder } from "../assets/js/explorerTree/handlers/openFolderHandler.js"
import { bindFileClicks } from "../assets/js/explorerTree/handlers/bindFileClicksHandler.js"

let isSaveAviable = true

export function disableSave() {
    isSaveAviable = false
}
export function enableSave() {
    isSaveAviable = true
}

document.addEventListener("DOMContentLoaded", async () => {
    ace.config.set("basePath", "../ace/src-noconflict");
    ace.config.set("modePath", "../ace/src-noconflict");
    ace.config.set("workerPath", "../ace/src-noconflict");
    
    let __dirname = await getDirname()
    let userSettings = await readSettings()

    await handleSettings(userSettings)

    if("app" in userSettings) {
        if("devMode" in userSettings.app) {
            if(userSettings.app.devMode) {
                window.electron.createDebuggerWindow()
                await window.electron.onDebuggerReady()

                const developerModeTopBar = new TopBarElement("devMode")
                developerModeTopBar.content({ icon: "bug_report", text: "Developer mode enabled", type: "notification" })

                setTimeout(() => {
                    developerModeTopBar.show()

                    setTimeout(() => {
                        developerModeTopBar.hide({ iconVisible: true })
                    }, 3000)
                }, 1000)

                developerModeTopBar.on("hover", (instance) => { instance.show() })
                developerModeTopBar.on("unhover", (instance) => { instance.hide({ iconVisible: true }) })
            }
        }
    }

    window.electron.mainReady();

    handlePopups()
    handlePopovers()
    initExtensions()
    initActions()

    // drag n drop files

    const fileDragDrop = new DragDrop(document.querySelector(".code-wrapper"))
    fileDragDrop.onDrop(({ content, name, extension }) => {
        openTab(name, content, extension, name, undefined, true)
    }) 

    // 

    sendDebugMsg("App started")

    // update language "Python" and set version in name
    const pythonInfo = await window.electron.getPython()
    if(pythonInfo) {
        Languages.update("py", {
            name: `Python (${pythonInfo.version})`,
            icon: "py",
            iconExt: "svg",
            mode: "python"
        })
    }
    // 

    // set text-color to l-rings (loaders)
    document.querySelectorAll("l-ring").forEach(loader => {
        const textColor = window.getComputedStyle(document.documentElement).getPropertyValue("--text-color")
        loader.setAttribute("color", textColor)
    })
    // 
    
    handleOnWheelScrollX()

    const settings = userSettings
    const appIcon = await window.electron.getAppIcon()

    const pathContext = {}

    document.querySelector(".code-start__main-logo").src = appIcon

    const SEGMENTED_CONTROL_BASE_SELECTOR = ".segmented-control";
    const SEGMENTED_CONTROL_INDIVIDUAL_SEGMENT_SELECTOR = ".segmented-control .option input";
    const SEGMENTED_CONTROL_BACKGROUND_PILL_SELECTOR = ".segmented-control .selection";

    setup()

    function setup() {
        forEachElement(SEGMENTED_CONTROL_BASE_SELECTOR, (elem) => {
            elem.addEventListener("change", updatePillPosition);
        });
        window.addEventListener("resize", updatePillPosition);

    }

    function updatePillPosition() {
        forEachElement(
            SEGMENTED_CONTROL_INDIVIDUAL_SEGMENT_SELECTOR,
            (elem, index) => {
                if (elem.checked) moveBackgroundPillToElement(elem, index);
            }
        );
    }

    function moveBackgroundPillToElement(elem, index) {
        console.log(elem.offsetWidth * index);
        document.querySelector(
            SEGMENTED_CONTROL_BACKGROUND_PILL_SELECTOR
        ).style.transform = "translateX(" + elem.offsetWidth * index + "px)";
    }

    function forEachElement(className, fn) {
        Array.from(document.querySelectorAll(className)).forEach(fn);
    }

    showIndicator()

    // States
    const historyObject = {};
    const bugsObject = {};
    const priorityClasses = object.priorityClasses

    window.historyObject = historyObject
    window.bugsObject = bugsObject
    window.priorityClasses = priorityClasses

    const explorerTitle = document.querySelector(".explorer-title__name");
    const loader = document.querySelector(".loader");
    const mainWrapper = document.querySelector(".main-wrapper");
    const topbar = document.querySelector(".topbar");
    const explorer = document.querySelector(".explorer");
    const filesPanel = document.querySelector('.explorer-elements[data-tab="files"]');
    // Main
    setUserPcInfo();

    getCurrentUserDataFromAPI().then((e) => {
        if (!e.success) {
            const errEl = loader?.querySelector(".loader-msg");
            if (errEl) {
                errEl.classList.remove("hidden");
                errEl.textContent = `Error: ${e.result.result}`;
            }
        } else {
            loader?.classList.add("hidden");
        }
    });

    // Explorer tabs

    document.querySelectorAll(".sidebar-item").forEach(tab => {
        const id = tab.getAttribute("id");

        tab.addEventListener("click", () => {
            document.querySelectorAll("[visibleOn]").forEach(el => {
                const tabID = tab.id
                const visibleID = el.getAttribute("visibleOn")

                if(visibleID.startsWith("tab:")) {
                    if(tabID == visibleID.split("tab:")[1]) {
                        el.classList.remove("hidden")
                    }
                    else {
                        el.classList.add("hidden")
                    }
                }
            })

            if(tab.getAttribute("nondefault") != null) return

            document.querySelectorAll(".sidebar-item").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            if (tabName) {
                tabName.textContent = id === "files" ? "explorer" : id;
            }
            if (document.querySelector(`[data-tab="${id}"]`)) {
                document.querySelectorAll(`[data-tab]`).forEach(t => t.classList.add("hidden"));
                document.querySelector(`[data-tab="${id}"]`).classList.remove("hidden");
            }
            setTabNameCounter(false);

            if(id == "files") {
                if(Object.keys(pathContext).length > 0) {
                    if("root" in pathContext) {
                        setTabName(pathContext.root)
                    }
                }
            }

            if (id === "history") {
                const root = document.querySelector(`.explorer-elements[data-tab="${id}"] .elements`);
                handleHistoryTab(
                    {
                        root: root,
                        historyObject: historyObject
                    }
                )
            }

            if (id === "bugs") {
                const root = document.querySelector(`.explorer-elements[data-tab="${id}"] .elements`);
                const rootParent = document.querySelector(`.explorer-elements[data-tab="${id}"]`);
                handleBugsTab(
                    {
                        root: root,
                        rootParent: rootParent,
                        bugsObject: bugsObject
                    }
                )
            }
        });

        if (tab.hasAttribute("default")) tab.click();
    });

    // File panel

    // Keybinds
    // Ctrl+Shift+T - open last closed tab
    window.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && e.code === "KeyT") {
            e.preventDefault();
            reopenLastClosed();
        }
    });

    // Save active tab
    window.electron.keyboardAction(async (data) => {
        const type = data.type

        if (type === "saved") {
            if(currentPath && tabsByPath.has(currentPath) && isSaveAviable) {
                const rec = tabsByPath.get(currentPath);

                if(rec.new) {
                    const saveNewFileRes = await window.electron.askToSaveNewFile(currentPath, currentContent)
                    
                    if(saveNewFileRes.success) {
                        rec.tabEl.classList.remove("not-saved")
                        currentPath = saveNewFileRes.path
                    }

                    return
                }

                const saveStatus = await window.electron.saveFile(currentPath, rec.editor.getValue());
                if (saveStatus.success) {
                    rec.tabEl.classList.remove("not-saved");
                    addToHistory("file-saved", currentPath.split(/[\\/]/).pop(), currentPath);
                }
            }
        }
    })

    // File clicks (explorer)

    if (filesPanel) bindFileClicks(
        {
            scopeEl: filesPanel,
            tabsByPath: tabsByPath,
            recentlyClosed: recentlyClosed,
            pathContext: pathContext,
            settings: settings
        }
    );

    if (topbar && mainWrapper) {
        mainWrapper.style.cssText = `height: calc(100% - ${topbar.offsetHeight}px)`;
    }

    new SidebarResizeHandler({
        explorer,
        mainWrapper,
        settings,
        onResizeEnd: () => {
            tabsByPath.forEach((tab) => tab.editor?.resize?.())
        }
    })

    // open folder btn

    document.querySelector("#open_folder").addEventListener("click", async () => {
        const l = new Loader(document.querySelector(".explorer-elements[data-tab='files']"),
            { 
                size: "20px", 
                stroke: "1px", 
                pos: "absolute-center", 
                method: "inner" 
            }
        )
        l.render()

        let openedFile = await window.electron.requestFolder()

        l.remove()

        openFolder(
            {
                pathRoot: openedFile,
                filesPanel: filesPanel,
                addToHistory: addToHistory,
                pathContext: pathContext,
                settings: settings
            }
        )
    })
})
