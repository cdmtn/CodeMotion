import { Languages } from "../lib.js";
import { TopWindowList, destroyAllTopWindowLists } from "../topWindowHandler/topWindowList.js";

let languageTarget = null
let languageListReady = null

function setLanguageLabel(name) {
    document.querySelectorAll("#currentLang").forEach(e => {
        e.textContent = name
    })
}

async function buildLanguageList() {
    const aviableLanguageNames = []

    const languages = Object.entries(Languages.list())
        .filter(([_, lang]) =>
            !["Image", "Font", "To-Do List", "GIT File"].includes(lang.name)
        )
        .filter(([_, lang], index, arr) =>
            arr.findIndex(([_, l]) => l.name === lang.name) === index
        )

    for (const [key, lang] of languages) {
        const icon = await Languages.getIconPath(key)

        aviableLanguageNames.push({
            name: lang.name,
            id: key,
            secondary: key,
            icon
        })
    }

    const changeLanguageList = new TopWindowList("changeLanguage", aviableLanguageNames)

    changeLanguageList.on("click", (data) => {
        if (!languageTarget) return
        languageTarget.setLanguage(data.id)
        languageTarget.languageLabel = data.name
        setLanguageLabel(data.name)
    })

    const labelEl = document.querySelector("#currentLang")
    if (labelEl) changeLanguageList.bind(labelEl)
}

export async function setCurrentLanguage(langName, properties = {}) {
    if (!properties.editor) throw new Error(`properties.editor required`)

    languageTarget = properties.editor
    if (langName) properties.editor.languageLabel = langName
    setLanguageLabel(properties.editor.languageLabel || langName || "")

    languageListReady ??= buildLanguageList()
    await languageListReady
}

export function setColumn(col) {
    document.querySelectorAll("#currentCol").forEach(e => {
        if (e) {
            e.textContent = col
        }
    })
}

export function setTabSize(size) {
    document.querySelectorAll("#currentTabSize").forEach(e => {
        if (e) {
            e.textContent = size
        }
    })

    window.electron.setSettings({ editor: { tabSize: size } })
}

export function setSymbols(len) {
    document.querySelectorAll("#currentSymbols").forEach(e => {
        if (e) {
            e.textContent = len
        }
    })
}

export function setErrors(object) {
    let errorObject = {}
    let warningObject = {}

    for (let e in object) {
        if (object[e].type == "error") {
            errorObject[e] = object[e]
        }
        if (object[e].type == "warning") {
            warningObject[e] = object[e]
        }
    }

    document.querySelectorAll("#errorCount").forEach(e => {
        if (e) {
            let len = Object.keys(errorObject).length

            e.parentElement.classList.toggle("text-danger", len > 0)
            e.textContent = Object.keys(errorObject).length
        }
    })
    document.querySelectorAll("#warningCount").forEach(e => {
        if (e) {
            let len = Object.keys(warningObject).length

            e.parentElement.classList.toggle("text-warning", len > 0)
            e.textContent = Object.keys(warningObject).length
        }
    })
}

export function toggleCodeFooter(bool) {
    if (bool) {
        document.querySelectorAll(".code-footer").forEach(e => {
            e.classList.remove("hidden")
        })
    }
    else {
        document.querySelectorAll(".code-footer").forEach(e => {
            e.classList.add("hidden")
        })
    }
}

export function setLine(line) {
    document.querySelectorAll("#currentLine").forEach(e => {
        if (e) {
            e.textContent = line
        }
    })
}

const runtimeErrors = document.querySelector("#runtimeErrors")
const bottomWarnings = document.querySelector("#bottomWarnings")
const bottomErrors = document.querySelector("#bottomErrors")

export function disableErrors(editor) {
    bottomErrors.classList.add("hidden")
    bottomWarnings.classList.add("hidden")

    runtimeErrors.classList.add("disabled")

    editor.setOption("useWorker", false);
}
export function enableErrors(editor) {
    bottomErrors.classList.remove("hidden")
    bottomWarnings.classList.remove("hidden")

    runtimeErrors.classList.remove("disabled")

    editor.setOption("useWorker", true);
}