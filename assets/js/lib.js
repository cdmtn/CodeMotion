import { ErrorReporter } from "./ErrorReporter.js"
import { BottomWindow } from "./handlers/BottomWindowHandler.js"

import { _Languages } from "./libClasses/languages.js"
import { _Dirs } from "./libClasses/dirs.js"
import { _Notificator } from "./libClasses/notificator.js"
import { _DragDrop } from "./libClasses/dragndrop.js"
import { _TopBarElement } from "./libClasses/topbarElement.js"
import { _SideBarIconManager } from "./libClasses/sidebarIconManager.js"
import { _Options } from "./libClasses/options.js"
import { _ContextMenuLoader } from "./libClasses/contextMenuLoader.js"
import { _Loader } from "./libClasses/loader.js"
import { valid } from "./modalsHandler/engine.js"
import { createDIV, createIcon } from "./modalsHandler/handlers/helpers.js"
import { _GLS } from "./libClasses/gls.js"
import { _Filenames } from "./libClasses/fillenames.js"

let runtimeErrors = []
let runtimeErrorsCount = 0

export const GLOBAL = {}

export const Languages = _Languages
export const Filenames = _Filenames
export const Dirs = _Dirs
export const DragDrop = _DragDrop
export const Notificator = _Notificator
export const TopBarElement = _TopBarElement
export const SideBarIconManager = _SideBarIconManager
export const Options = _Options
export const ContextMenuLoader = _ContextMenuLoader
export const Loader = _Loader
export const GLS = _GLS

// Language: adds a image icons
const imageIcons = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif", "tif", "tiff", "heic", "heif"]

imageIcons.forEach(id => {
    Languages.add(
        {
            id: id,
            name: "Image",
            icon: "image",
            iconExt: "svg",
            mode: "text"
        }
    )
})

// Language: adds a font icons
const fontIcons = ["ttf", "otf", "woff", "woff2", "eot"]

fontIcons.forEach(id => {
    Languages.add(
        {
            id: id,
            name: "Font",
            icon: "font",
            iconExt: "svg",
            mode: "text"
        }
    )
})

export const tabName = document.querySelector("#tab-name");

export function setTabNameCounter(count) {
    if (!tabName) return;
    const old = tabName.querySelector(".counter");

    if (count === false) {
        if (old) old.remove();
        return;
    }
    
    if (old) old.remove();
    tabName.insertAdjacentHTML("beforeend", `<span class="counter">${count}</span>`);
}
export function setTabName(text) {
    if (!tabName) return;
    tabName.innerHTML = text
}

export function toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}
export function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
export function getCodeByName(name, raw = false) {
    const ext = (name || "").toLowerCase();

    const names = {
        html: "html",
        js: "javascript",
        css: "css",
        json: "json",
        md: "markdown",
        todo: "markdown",
        ps: "prettyscript",
        py: "python",
        php: "php"
    };
    const rawNames = {
        html: "html",
        js: "javascript",
        ps: "prettyscript",
        py: "python",
        md: "markdown",
        css: "css",
        php: "php"
    };

    if (!raw) return names[ext] || "plaintext";
    return rawNames[ext] || "text";
}
async function getFileIconByName(name) {
    // fileicon - file name
    // ext - extenstion of icon, default: svg
    let ext = "svg"

    let alts = {
        ps: {
            ext: "svg",
            fileicon: "prettyscript"
        },
        todo: {
            ext: "svg",
            fileicon: "todo"
        },
        ttc: {
            ext: "svg",
            fileicon: "ttf"
        },
        otf: {
            ext: "svg",
            fileicon: "ttf"
        },
        woff: {
            ext: "svg",
            fileicon: "ttf"
        }
    }

    if (name in alts) {
        ext = alts[name].ext
        name = alts[name].fileicon
    }
    else {
        name = getCodeByName(name).replaceAll(/[0-9]/g, "")
    }

    let list = await window.electron.getAllIcons();
    let listNames = []

    list.forEach(e => {
        let filteredName = e.name.replaceAll("." + e.name.split(".").pop(), "")

        if (filteredName != "default") {
            listNames.push(e.name.replaceAll("." + e.name.split(".").pop(), ""))
        }
    })

    if (listNames.includes(name)) {
        return `./assets/media/icons/${name}.${ext}`
    }
    else {
        return `./assets/media/icons/default.svg`
    }
}

let inputs = document.querySelectorAll("input")

if (inputs.length > 0) {
    inputs.forEach(input => {
        input.addEventListener("input", () => {
            if (input.value > 0) {
                input.classList.add("focused")
            }
            else {
                input.classList.remove("focused")
            }
        })
    })
}

export function capitilize(text) {
    return String(text).charAt(0).toUpperCase() + String(text).slice(1)
}

export function addToHistory({ id, actionType, value, desc, today }) {
    const historyID = id != undefined ? id : Object.keys(historyObject).length + 1
    const historyValue = value != undefined ? value : "Untitled"
    const historyDesc = desc != undefined ? desc : "No description provided"
    const historyToday = today != undefined ? today : new Date().format("H:i")

    historyObject[historyID] = { 
        time: historyToday, 
        action: actionType, 
        value: historyValue, 
        description: historyDesc 
    };
}

export function addToBug({ id, priority, value, desc, today, isSelf, org, resolved, author, assignedTo, type }) {
    const bugID = id != undefined ? id : Object.keys(bugsObject).length + 1
    const bugPriority = priority != undefined ? priority : 0
    const bugDesc = desc != undefined ? desc : "No description provided"
    const bugToday = today != undefined ? today : new Date().format("H:i")
    const bugIsSelf = isSelf != undefined ? isSelf : false
    const bugResolved = resolved != undefined ? resolved : false
    const bugAuthor = author != undefined ? author : false
    const bugAssignedTo = assignedTo != undefined ? assignedTo : {}

    addToHistory({ actionType: "bug-added", value: value, desc: `Bug "${value}" added with ${priorityClasses[String(priority)].name} priority` });

    bugsObject[bugID] = {
        id: bugID,
        time: bugToday,
        priority: bugPriority,
        value: value,
        description: bugDesc,
        self: bugIsSelf,
        organization: org,
        resolved: bugResolved,
        author: bugAuthor,
        assignedTo: bugAssignedTo,
        type: type
    };

    return bugsObject
}

export function showIndicator(time = 1500, callback) {
    let statusIndicator = document.querySelector(".status-indicator")

    statusIndicator.classList.remove("hidden")

    if (typeof callback === "function") {
        callback(statusIndicator)
    }

    statusIndicator.addEventListener("transitionend", () => {
        setTimeout(() => {
            statusIndicator.classList.add("hidden")
        }, time)
    }, { once: true })
}

export const animate = {
    blurReplace: ({ add, remove }) => {
        if (!add || !remove) return;

        add.classList.remove("hidden", "blur-hidden");
        remove.classList.remove("hidden", "blur-hidden");

        remove.classList.add("blur-hidden");

        const onTransitionEnd = () => {
            remove.classList.add("hidden");
            remove.removeEventListener("transitionend", onTransitionEnd);

            add.classList.remove("hidden");
            add.classList.add("blur-hidden");

            requestAnimationFrame(() => {
                add.classList.remove("blur-hidden");
            });
        };

        remove.addEventListener("transitionend", onTransitionEnd);
    }
};

export function handlePopups() {
    const popups = document.querySelectorAll("[popup]");

    document.addEventListener("click", (e) => {
        let clickedInsidePopup = false;

        popups.forEach(popup => {
            const popupContent = popup.querySelector(".popup-content");
            const popupTitle = popup.querySelector(".popup-title");

            if (popupTitle.contains(e.target)) {
                e.stopPropagation();

                const isOpen = !popupContent.classList.contains("hidden");

                popups.forEach(p => p.querySelector(".popup-content").classList.add("hidden"));

                if (!isOpen) {
                    popupContent.classList.remove("hidden");
                    popupTitle.classList.add("active")
                }

                clickedInsidePopup = true;
            }

            if (e.target.closest(".popup-content__item") && popup.contains(e.target)) {
                popupContent.classList.add("hidden");
                popupTitle.classList.remove("active")
                clickedInsidePopup = true;
            }

            if (popup.contains(e.target)) {
                clickedInsidePopup = true;
            }
        });

        if (!clickedInsidePopup) {
            popups.forEach(p => { p.querySelector(".popup-content").classList.add("hidden"); p.querySelector(".popup-title").classList.remove("active") });
        }
    });
}

export function SmoothScroll(target, speed, smooth) {
    if (target === document)
        target = (document.scrollingElement
            || document.documentElement
            || document.body.parentNode
            || document.body) // cross browser support for document scrolling

    var moving = false
    var pos = target.scrollTop
    var frame = target === document.body
        && document.documentElement
        ? document.documentElement
        : target // safari is the new IE

    target.addEventListener('mousewheel', scrolled, { passive: false })
    target.addEventListener('DOMMouseScroll', scrolled, { passive: false })

    function scrolled(e) {
        e.preventDefault(); // disable default scrolling

        var delta = normalizeWheelDelta(e)

        pos += -delta * speed
        pos = Math.max(0, Math.min(pos, target.scrollHeight - frame.clientHeight)) // limit scrolling

        if (!moving) update()
    }

    function normalizeWheelDelta(e) {
        if (e.detail) {
            if (e.wheelDelta)
                return e.wheelDelta / e.detail / 40 * (e.detail > 0 ? 1 : -1) // Opera
            else
                return -e.detail / 3 // Firefox
        } else
            return e.wheelDelta / 120 // IE,Safari,Chrome
    }

    function update() {
        moving = true

        var delta = (pos - target.scrollTop) / smooth

        target.scrollTop += delta

        if (Math.abs(delta) > 0.5)
            requestFrame(update)
        else
            moving = false
    }

    var requestFrame = function () {
        return (
            window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function (func) {
                window.setTimeout(func, 1000 / 50);
            }
        );
    }()
}

export function runSandbox(code) {
    const logs = []

    function getPos() {
        const stack = new Error().stack.split("\n")[3]
        const match = stack.match(/:(\d+):(\d+)/)

        if (match) {
            return {
                line: Number(match[1]),
                col: Number(match[2])
            }
        }

        return {}
    }

    function formatArgs(args) {
        return args.map(arg => {
            if (typeof arg === "object" && arg !== null) {
                try {
                    return JSON.stringify(arg)
                } catch {
                    return "[Object]"
                }
            }
            return arg
        })
    }

    const consoleProxy = {
        log: (...args) => {
            const pos = getPos()

            logs.push({
                type: "log",
                line: pos.line,
                col: pos.col,
                args: formatArgs(args)
            })
        },

        warn: (...args) => {
            const pos = getPos()

            logs.push({
                type: "warn",
                line: pos.line,
                col: pos.col,
                args: formatArgs(args)
            })
        },

        error: (...args) => {
            const pos = getPos()

            logs.push({
                type: "error",
                line: pos.line,
                col: pos.col,
                args: formatArgs(args)
            })
        }
    }

    try {
        const fn = new Function(
            "console",
            code + "\n//# sourceURL=sandbox.js"
        )

        fn(consoleProxy)
    } catch (e) {
        logs.push({
            type: "error",
            args: [e.message]
        })
    }

    return logs
}
export function runCode(code, acorn) {
    try {
        // syntax check
        acorn.parse(code, {
            ecmaVersion: "latest",
            locations: true,
            sourceType: "module"
        })
    } catch (err) {
        return ErrorReporter.fromAcorn(err)
    }

    try {
        // sandbox run check
        runSandbox(code)
    } catch (err) {
        return ErrorReporter.fromRuntime(err)
    }

    return null
}
export function addRuntimeError({ msg, line = null, col = null, time = null, isNull = false, win = null }) {
    const exists = runtimeErrors.some(
        e => e.msg === msg && e.line === line && e.col === col
    )

    const wrapper = BottomWindow.get("errorsHistory")
    const badge = document.querySelector("#runtimeErrors .badge")
    const el = document.createElement("div")
    const items = document.querySelectorAll(".runtime-item#runTimeErrorItem")
    const lastItem = items[items.length - 1]

    if (isNull && lastItem?.classList.contains("success")) return
    if (exists) return

    const error = { msg, line, col }

    if (!isNull) {
        runtimeErrors.push(error)
        runtimeErrorsCount += 1
    }
    else {
        runtimeErrors = []
        badge.classList.add("hidden")
    }

    badge.classList.remove("hidden")
    badge.textContent = runtimeErrors.length

    if (runtimeErrors.length == 0) {
        badge.classList.add("hidden")
    }

    items.forEach(e => { e.classList.add("prev") })

    el.classList.add("runtime-item", "bottom-window__item")
    el.id = "runTimeErrorItem"

    if (!isNull) {
        el.innerHTML = `
            <span class="material-symbols-rounded error">error</span>
            ${msg}
            ${line !== null ? `<span class="translucent">${line}:${col ?? 0}</span>` : ""}
            ${time !== null ? `<span class="time">${formatUnix(time)}</span>` : ""}
        `
    }
    else {
        el.classList.add("success")
        el.innerHTML = `
            <span class="material-symbols-rounded error">check_circle</span>
            All errors fixed
            ${runtimeErrorsCount > 0 ? `<span class="translucent">(${runtimeErrorsCount})</span>` : ""}
            ${time !== null ? `<span class="time">${formatUnix(time)}</span>` : ""}
        `
        runtimeErrorsCount = 0
    }

    wrapper.add(el)

    wrapper.win.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
}
export function clearRuntimeErrors() {
    runtimeErrors = []
    runtimeErrorsCount = 0

    const items = document.querySelectorAll(".runtime-item#runTimeErrorItem")
    items.forEach(i => {
        console.log(i)
    })

    addRuntimeError(
        {
            isNull: true,
            time: Math.floor(Date.now() / 1000)
        }
    )
}

export function formatUnix(ts, format = "{dd}.{mm}.{yyyy}, {hh}:{ii}:{ss}") {
    const date = new Date(ts * 1000);

    const yyyy = String(date.getFullYear());
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");

    const hh = String(date.getHours()).padStart(2, "0");
    const ii = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");

    if(format) {
        return format
            .replaceAll("{dd}", dd)
            .replaceAll("{mm}", mm)
            .replaceAll("{hh}", hh)
            .replaceAll("{ii}", ii)
            .replaceAll("{ss}", ss)
            .replaceAll("{yyyy}", yyyy)
    }
    else {
        return `${dd}.${mm}, ${hh}:${ii}:${ss}`;
    }
}

export function getInitials(name) {
    if (!name) return 'A';
    const words = name.trim().split(/\s+/);
    return words.slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

export function generateAvatar(name) {
    function stringToColorPair(input) {
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            hash = input.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        const saturation = 60;
        const fgLightness = 30;
        const bgLightness = 90;

        const hslToHex = (h, s, l) => {
            s /= 100;
            l /= 100;
            const k = n => (n + h / 30) % 12;
            const a = s * Math.min(l, 1 - l);
            const f = n =>
                Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))))
                    .toString(16)
                    .padStart(2, '0');
            return `#${f(0)}${f(8)}${f(4)}`;
        };

        return {
            foreground: hslToHex(hue, saturation, fgLightness),
            background: hslToHex(hue, saturation, bgLightness),
            background_second: hslToHex(hue, saturation, bgLightness - 10)
        };
    }

    let initials = getInitials(name)
    let color = stringToColorPair(name)

    const generated = document.createElement("div")
    generated.classList.add("generated-avatar")
    generated.style.cssText = `--background: ${color.background};--background-second: ${color.background_second};--foreground: ${color.foreground};`
    generated.textContent = initials

    return generated.outerHTML
}

export function isFloat(n) {
    return typeof n === 'number' && !Number.isInteger(n);
}

export function isStringifiedObject(str) {
    try {
        const parsed = JSON.parse(str);

        if (Array.isArray(parsed)) return "array"
        if (typeof parsed === 'object' && parsed !== null) {
            return "object"
        }
        return null
    } catch (e) {
        return false;
    }
}

export function truncateString(str, maxLength) {
    if (str.length <= maxLength) {
        return str;
    }

    return str.slice(0, maxLength) + '...';
}

export function createNotify(properties = {}) {
    const type = valid(properties.type) ?? "info_i"
    const icon = valid(properties.icon) ?? "info_i"
    const title = valid(properties.title) ?? "Untitled"
    const content = valid(properties.content) ?? "No description provided"
    const time = valid(properties.time) ?? 3000
    const image = valid(properties.image) ?? false

    const notifyObject = {
        title: title,
        description: content,
        timeout: time
    }

    if(icon) notifyObject["icon"] = icon
    if(type) notifyObject["type"] = type
    if(image) notifyObject["image"] = image

    window.electron.createNotification(notifyObject)
}

export function getTheme() {
    return document.body.getAttribute("theme") != null ? document.body.getAttribute("theme") : "default"
}

export function handleOnWheelScrollX() {
    const elements = document.querySelectorAll(".code-tabs, .commands .commands-suggest")

    elements.forEach(el => {
        el.addEventListener("wheel", (event) => {
            event.preventDefault()

            el.scrollBy({
                left: event.deltaY / 5
            })
        }, { passive: false })
    })
}

export function idify(string) {
    const bytes = new TextEncoder().encode(string);
    let binary = "";

    bytes.forEach(b => binary += String.fromCharCode(b));

    return btoa(binary).replaceAll("=", "");
}

export function splitCamelCase(str) {
    return str
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .split(" ")
        .map((w, i) => i === 0
            ? w.charAt(0).toUpperCase() + w.slice(1)
            : w.toLowerCase()
        )
}

export function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        console.log("Text copied to clipboard successfully!");
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

export function normalizePath(path) {
    return path
        .replaceAll("\\", "/")
        .replaceAll(/\\/g, "/")
}

export function parseTwemojiString(text) {
    return twemoji.parse(text, {
        folder: "svg",
        ext: ".svg"
    })
}

export function parseTwemojiElement(element) {
    if (!element) return

    twemoji.parse(element, {
        folder: "svg",
        ext: ".svg"
    })
}

export function scrollToBottomSmooth(el) {
    el.scrollTo({
        top: el.scrollHeight,
        behavior: "smooth"
    });
}

export function getAllCSSVariables() {
    return Array.from(document.styleSheets)
        .filter(
            sheet =>
                sheet.href === null || sheet.href.startsWith(window.location.origin)
        )
        .reduce(
            (acc, sheet) =>
            (acc = [
                ...acc,
                ...Array.from(sheet.cssRules).reduce(
                    (def, rule) =>
                    (def =
                        rule.selectorText === ":root"
                            ? [
                                ...def,
                                ...Array.from(rule.style).filter(name =>
                                    name.startsWith("--")
                                )
                            ]
                            : def),
                    []
                )
            ]),
            []
        );
}

export function type(value) {
    const str = value.toString().trim()

    if (/^-?\d+$/.test(str)) return "int"
    if (/^-?\d*\.\d+$/.test(str)) return "float"
    if (/^(true|false)$/.test(str)) return "boolean"
    if (/^\[.*\]$/.test(str)) return "array"
    if (/^\{.*\}$/.test(str)) return "object"

    return "string"
}

export function eventLog(...args) {
    console.warn(`[EVENT LOG] -----------\n`, ...args)
}

export function loadAceModule(moduleName, callback) {
    try {
        const mod = ace.require(moduleName)
        callback(mod);
    } catch (e) {
        const script = document.createElement("script");
        script.src = `../ace/src-noconflict/${moduleName}.js`;

        if(callback) {
            script.onload = () => {
                callback(ace.require(moduleName));
            };
        }
        document.head.appendChild(script);
    }
}
export const loadAceModuleAsync = (moduleName) => {
    return new Promise((resolve) => {
        loadAceModule(moduleName)
        resolve()
    })
}

const CODE_WINDOW_VISUALS_TABS = document.querySelector(".code-tabs")
const CODE_WINDOW_VISUALS_FOOTER = document.querySelector(".code-footer")

export function isObject(item) {
    return typeof item == "object" && !Array.isArray(item)
}
export function isArray(item) {
    return typeof item == "object" && Array.isArray(item)
}

export function showCodeWindowVisuals() {
    CODE_WINDOW_VISUALS_TABS.classList.remove("hidden")
    CODE_WINDOW_VISUALS_FOOTER.classList.remove("hidden")
}
export function hideCodeWindowVisuals() {
    CODE_WINDOW_VISUALS_TABS.classList.add("hidden")
    CODE_WINDOW_VISUALS_FOOTER.classList.add("hidden")
}

export function changeTagName(oldElement, newTagName) {
    const newElement = document.createElement(newTagName);

    for (const attr of oldElement.attributes) {
        newElement.setAttribute(attr.name, attr.value);
    }

    while (oldElement.firstChild) {
        newElement.appendChild(oldElement.firstChild);
    }

    oldElement.replaceWith(newElement);
}

export function showNeedReloadTopBar() {
    const needToReloadTopBar = new TopBarElement("needReload")
    needToReloadTopBar.content({ icon: "cached", text: "You need to reload application", type: "danger" })

    setTimeout(() => {
        needToReloadTopBar.show()

        setTimeout(() => {
            needToReloadTopBar.hide({ iconVisible: true })
        }, 3000)
    }, 1000)

    needToReloadTopBar.on("hover", (instance) => { instance.show() })
    needToReloadTopBar.on("unhover", (instance) => { instance.hide({ iconVisible: true }) })
}

export function secondsToMinutes(seconds) {
    return seconds / 60;
}

export function transparentColor(color, alpha = 1) {
    alpha = Math.max(0, Math.min(1, alpha));
    color = color.trim();

    if (color.startsWith('#')) {
        let hex = color.slice(1);

        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }

        if (hex.length !== 6) {
            throw new Error('Invalid HEX color');
        }

        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    const match = color.match(
        /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/i
    );

    if (match) {
        const [, r, g, b] = match;

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    throw new Error('Unsupported color format');
}

window.Notificator = Notificator
window.addToBug = addToBug
window.addToHistory = addToHistory
window.showIndicator = showIndicator
window.animate = animate