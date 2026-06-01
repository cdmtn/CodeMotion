export function renderPyMsgSuccess({ RuntimeHistoryWindow, pythonResult, method }) {
    const item = document.createElement("div")
    item.className = "log bottom-window__item"
    const itemContent = document.createElement("span")
    itemContent.className = "translucent"
    itemContent.textContent = pythonResult.file + " >>"
    item.appendChild(itemContent)

    const stdoutSpan = document.createElement("span")
    stdoutSpan.textContent = pythonResult.stdout
    item.appendChild(stdoutSpan)

    RuntimeHistoryWindow.add(item)

    const exitCodeItem = document.createElement("div")
    exitCodeItem.className = "log whitespaced bottom-window__item"
    exitCodeItem.textContent = `Exit code ${pythonResult.exitCode}`

    RuntimeHistoryWindow.add(exitCodeItem)
}

export function renderPyMsgErr({ RuntimeHistoryWindow, pythonResult, method }) {
    const item = document.createElement("div")
    item.className = "log whitespaced bottom-window__item"

    const fileSpan = document.createElement("span")
    fileSpan.className = "translucent"
    fileSpan.textContent = pythonResult.file + " >>"
    item.appendChild(fileSpan)

    const errorDiv = document.createElement("div")
    errorDiv.className = "log-error"
    errorDiv.textContent = `${pythonResult.stderr}`

    if(method == "builtin" && pythonResult.stderr.includes("ModuleNotFoundError")) {
        errorDiv.textContent += `\nThis may be because you are using the built-in launch method. Custom modules are not available with this method. To ensure full functionality, you need to install Python from the official website and, after restarting the application, select your installed Python version in the settings: https://www.python.org/downloads/`
    }

    item.appendChild(errorDiv)

    RuntimeHistoryWindow.add(item)

    const exitCodeItem = document.createElement("div")
    exitCodeItem.className = "log bottom-window__item"
    exitCodeItem.textContent = `Exit code ${pythonResult.exitCode}`

    RuntimeHistoryWindow.add(exitCodeItem)
}