import { type, handleOnWheelScrollX } from "../../assets/js/lib.js"
import { parse, trimSpaces, createCommandRegex } from "./parse.js"

const main = document.querySelector("#main")
const commandInput = document.querySelector("#command")
const btnCopy = document.querySelector("#btn-copy")
const btnCopyFile = document.querySelector("#btn-copy-file")
const time = `[${formatTimeHTML(Date.now())}]`
window.electron.ready()

const modules = {}
let variables = {}
let logs = []

function setVariable({ name, value, type }) {
    type = type == undefined ? "default" : type
    variables[name] = { value: value, type: type }
}

function parseFontCommand(fontName) {
    if (fontName == "system") {
        localStorage.setItem("font", fontName)
        document.body.style.cssText = "font-family: monospace"
    }
    if (fontName == "default") {
        localStorage.setItem("font", fontName)
        document.body.style.cssText = ""
    }
}

if(localStorage.getItem("font") != null) {
    parseFontCommand(localStorage.getItem("font"))
}

function findMatches(text, values) {
    const query = text.toLowerCase();

    return values
        .map(value => {
            const v = value.toLowerCase();

            let score = 0;

            if (v.includes(query)) score += 10;

            let i = 0;
            for (let char of v) {
                if (char === query[i]) {
                    i++;
                    score++;
                }
            }

            return { value, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.value);
}

const commands = {
    log: (text) => {
        renderMsg(time, text)
    },
    "print": (text) => {
        commands.log(text)
    },
    ">>": (text) => {
        commands.log(text)
    },
    ">!": (text) => {
        commands.err(text)
    },
    ">?": (text) => {
        commands.warn(text)
    },
    warn: (text) => {
        renderWarn(time, text)
    },
    err: (text) => {
        renderError(time, text)
    },
    modules: () => {
        renderMsg(time, `List of all installed modules: ${Object.keys(modules).join(", ")}`)
    },
    seslen: () => {
        renderMsg(time, `Commands executed during the session: ${logs.length}`)
    },
    clear: () => {
        logs.forEach(i => {
            i.remove()
        })
        logs = []
    },
    "-m": (name) => {
        if (name in modules) {
            renderMsg(time, `${name}@${modules[name].version} Module. ${modules[name].description}\nGet module version: -mv ${name}\nGet module permissions: -mp ${name}`)
        }
        else if (name.length == 0) {
            renderError(time, `Argument 0:{name} is empty`)
        }
        else {
            renderError(time, `Module "${name}" not defined in this scope. Defined modules: ${Object.keys(modules).join(", ")}`)
        }
    },
    "-mv": (name) => {
        if (name in modules) {
            renderMsg(time, modules[name].version)
        }
        else if (name.length == 0) {
            renderError(time, `Argument 0:{name} is empty`)
        }
        else {
            renderError(time, `Module "${name}" not defined in this scope`)
        }
    },
    "-mp": (name) => {
        if (name in modules) {
            renderMsg(time, modules[name].permissions.join(", "))
        }
        else if (name.length == 0) {
            renderError(time, `Argument 0:{name} is empty`)
        }
        else {
            renderError(time, `Module "${name}" not defined in this scope`)
        }
    },
    font: (name) => {
        const fonts = ["system", "default"]

        if(name.length == 0) {
            renderMsg(time, `Aviable fonts: ${fonts.join(", ")}. Current: ${localStorage.getItem("font") != null ? localStorage.getItem("font") : "default"}`)
        }
        else if(fonts.includes(name)) {
            parseFontCommand(name)
        }
    },
    fetch: async (url) => {
        if(url.startsWith("http")) {
            let f = await fetch(url)
            let result = await f.text()

            try {
                let parsed = JSON.parse(result)
                renderMsg(time, JSON.stringify(parsed))
            }
            catch(e) {
                renderError(time, `JSON parse error: ${e}`)
            }
        }
        else {
            renderError(time, `The fetch command accepts only URLs. \nExample: <code>fetch https://</code>`)
        }
    },
    var: (name) => {
        variables[name] = { value: false }
    },
    vars: () => {
        renderMsg(time, Object.keys(variables).map(item => `$${item}`).join(", "))
    },
    exit: () => {
        window.electron.close()
    }
}

function parseCommand(command, silent = false) {
    setTimeout(() => {
        window.scrollTo(0, document.body.scrollHeight)
    }, 0)

    const time = `[${formatTimeHTML(Date.now())}]`
    const response = document.createElement("div")
    response.classList.add("debug-item", "transparent")
    if(!silent) response.textContent = `>> ${command}`

    command = command.replace(/\$([a-zA-Z0-9_]+)/g, (match, varName) => {
        if(varName in variables) {
            return variables[varName].value
        }
        return undefined
    })

    command = command.replace(createCommandRegex("type"), (match, value) => {
        value = trimSpaces(value)
        if(value.startsWith("$")) {
            value = value.replace("$", "")
            if(value in variables) {
                return type(variables[value].value)
            }
        }
        return type(value)
    })
    command = command.replace(createCommandRegex("str"), (match, value) => {
        value = trimSpaces(value)

        return value.trim()
    })
    command = command.replace(createCommandRegex("empty"), (match, value) => {
        value = trimSpaces(value)
        return value.length == 0
    })
    command = command.replace(createCommandRegex("len"), (match, value) => {
        value = trimSpaces(value)
        return value.length
    })
    command = command.replace(createCommandRegex("rand"), (match, value) => {
        value = trimSpaces(value)
        let min = 0
        let max = 999999

        if (value) {
            let splitted = value.split(",")

            if (splitted[0]) min = Number(splitted[0].trim())
            if (splitted[1]) max = Number(splitted[1].trim())
        }

        if (isNaN(min)) min = 0
        if (isNaN(max)) max = 999999

        if (min > max) [min, max] = [max, min]

        return Math.floor(Math.random() * (max - min + 1)) + min
    })
    command = command.replace(createCommandRegex("time"), (match, value) => {
        value = trimSpaces(value)
        const now = new Date()
        const pad = (num) => String(num).padStart(2, "0")

        const map = {
            "dd": pad(now.getDate()),
            "d": now.getDate(),

            "mm": pad(now.getMonth() + 1),
            "m": now.getMonth() + 1,

            "yyyy": now.getFullYear(),
            "yy": String(now.getFullYear()).slice(-2),

            "hh": pad(now.getHours()),
            "h": now.getHours(),

            "ii": pad(now.getMinutes()),
            "i": now.getMinutes()
        }

        if (value.length === 0) {
            return `${map.dd}.${map.mm}.${map.yyyy}, ${map.hh}:${map.ii}`
        }

        let result = value
        const tokens = Object.keys(map).sort((a, b) => b.length - a.length)

        for (const token of tokens) {
            result = result.replace(new RegExp(token, "g"), map[token])
        }

        return result
    })

    Object.keys(variables).forEach(v => {
        commands[`set:${v}`] = (value) => { 
            if(variables[v].type != "const") {
                setVariable({ name: v, value: value, type: "default" })
            }
            else {
                renderError(time, `Error in the declaration of the variable "${v}": the variable is a constant`)
            }
        
        }
    })

    main.appendChild(response)

    logs.push(response)

    commands["-c"] = () => {
        const commandList = Object.entries(commands).map(([name, fn]) => {
            const argsMatch = fn.toString().match(/\(([^)]*)\)/);
            const args = argsMatch && argsMatch[1].trim() ? `{${argsMatch[1].trim()}}` : "";
            return `<code>${name} ${args}</code>`.trim();
        });
        renderMsg(time, `Commands: \n${commandList.join("\n")}`);
    };

    command.split(";").map(item => item.trim()).forEach(i => {
        executeCommand(i)
    })

    function executeCommand(command) {
        const splitted = command.split(/\s/g)
        const prefix = splitted[0]

        if (prefix in commands) {
            return commands[prefix](splitted.filter(item => item != prefix).join(" "))
        }
        else {
            let error = `Command "${prefix}" doesn't exists`
            renderError(time, error)

            return error
        }
    }

    main.querySelectorAll("code").forEach(el => {
        el.addEventListener("click", (e) => {
            commandInput.value = e.target.textContent
        })
    })

    // set variables
    setVariable({ name: "seslen", value: logs.length, type: "const" })
}

function formatTimeHTML(timestampMs) {
    const date = new Date(timestampMs)

    const h = String(date.getHours()).padStart(2, "0")
    const m = String(date.getMinutes()).padStart(2, "0")
    const s = String(date.getSeconds()).padStart(2, "0")

    return `${h}<span class="transparent">h</span>:${m}<span class="transparent">m</span>:${s}<span class="transparent">s</span>`
}

function renderMsg(time, content, from = false) {
    const item = document.createElement("div")
    item.classList.add("debug-item")
    item.innerHTML = `${from != false ? `<span class="from">${from}</span>` : ""}<div class="debug-time">${time}</div><div>${parse(content)}</div>`

    if (from != false) item.classList.add("foreign")

    main.appendChild(item)

    logs.push(item)
}
function renderError(time, content, from = false) {
    const item = document.createElement("div")
    item.classList.add("debug-item", "error")
    item.innerHTML = `${from != false ? `<span class="from">${from}</span>` : ""}<div class="debug-time">${time}</div><div>${parse(content)}</div>`

    if (from != false) item.classList.add("foreign")

    main.appendChild(item)

    logs.push(item)
}
function renderWarn(time, content, from = false) {
    const item = document.createElement("div")
    item.classList.add("debug-item", "warn")
    item.innerHTML = `${from != false ? `<span class="from">${from}</span>` : ""}<div class="debug-time">${time}</div><div>${parse(content)}</div>`

    if (from != false) item.classList.add("foreign")

    main.appendChild(item)

    logs.push(item)
}
function renderMarking() {
    const item = document.createElement("div")
    item.classList.add("marking")

    main.appendChild(item)

    logs.push(item)
}

window.electron.onDebugData((data) => {
    let type = data.data.type
    let time = `[${formatTimeHTML(data.time)}]`

    if (type == "msg") {
        renderMsg(time, data.data.content, data.data.from)
    }
    if (type == "error") {
        renderError(time, `❌ ${data.data.content}`, data.data.from)
    }
    if (type == "warn") {
        renderWarn(time, `⚠️ ${data.data.content}`, data.data.from)
    }
    if (type == "marking") {
        renderMarking()
    }

    if (type == "moduleInfo") {
        let module = data.data.info
        modules[module.name] = {
            version: module.version,
            description: module.description,
            permissions: module.permissions
        }
    }
    if (type == "newCommand") {
        const time = `[${formatTimeHTML(Date.now())}]`
        let command = data.data.command

        renderMsg(time, `Added new command: ${command.name}`, data.data.from)

        commands[command.name] = () => {
            renderMsg(time, command.response)
        }
    }
    if (type == "execCommand") {
        let command = data.data.command
        parseCommand(command, true)
    }
})

commandInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();

        parseCommand(event.target.value)
        document.querySelector(".commands-suggest").classList.add("hidden")
        event.target.value = ""
    }
});

commandInput.addEventListener("input", (event) => {
    handleOnWheelScrollX()

    let text = event.target.value
    let finder = findMatches(text, Object.keys(commands))

    let suggest = document.querySelector(".commands-suggest")
    suggest.innerHTML = ""

    if(text.length == 0 || finder.length == 0) {
        suggest.classList.add("hidden")
    }
    else if(finder.includes(text)) {
        suggest.classList.add("hidden")
    }
    else {
        suggest.classList.remove("hidden")
        finder.forEach(item => {
            const suggestItem = document.createElement("div")
            suggestItem.classList.add("commands-suggest__item")
            suggestItem.textContent = item

            suggest.appendChild(suggestItem)

            suggestItem.addEventListener("click", () => {
                event.target.value = item
                event.target.focus()
                suggest.classList.add("hidden")
            })
        })
    }
})

function getAllDebugLines() {
    const items = main.querySelectorAll(".debug-item")
    return Array.from(items).map(el => el.textContent.trim()).filter(t => t.length > 0).join("\n")
}

btnCopy.addEventListener("click", () => {
    const text = getAllDebugLines()
    if (text.length > 0) {
        window.electron.copyText(text)
    }
})

btnCopyFile.addEventListener("click", () => {
    const text = getAllDebugLines()
    if (text.length > 0) {
        window.electron.copyAsFile(text)
    }
})