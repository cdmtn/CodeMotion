import { Languages } from "../lib.js";
import { TopWindowList, destroyAllTopWindowLists } from "../topWindowHandler/topWindowList.js";

export async function setCurrentLanguage(langName, properties = {}) {
    if (!properties.editor) throw new Error(`properties.editor required`)

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
        document.querySelectorAll("#currentLang").forEach(e => {
            properties.editor.setLanguage(data.id)
            e.textContent = data.name
        })
    })

    document.querySelectorAll("#currentLang").forEach(e => {
        e.textContent = langName
    })

    changeLanguageList.bind(document.querySelector("#currentLang"))
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