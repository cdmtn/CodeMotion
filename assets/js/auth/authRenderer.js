import { GLS } from "../lib.js"

export let inputs = document.querySelectorAll("input")
export let submitBtn = document.querySelector(".form-submit")
export let usernameInput = document.querySelector("#username")
export let emailInput = document.querySelector("#email")
export let codeInput = document.querySelector("#code")
export let passwordInput = document.querySelector("#password")
export let confirmPassword = document.querySelector("#confirm_password")
export let errorBlock = document.querySelector(".user-form__error")

export const userFormWrapper = document.querySelector(".user-form__wrapper")

export function getFormLabel(input) {
    if(input) {
        return input.parentElement.querySelector(".form-label")
    }
}

let submitBtnOriginText = submitBtn.textContent
let loadingHTML = `
<l-line-spinner
    size="20"
    stroke="2"
    speed="1"
    color="white"
></l-line-spinner>
`

export function disableButtons() {
    if (usernameInput) {
        usernameInput.parentElement.setAttribute("disabled", true)
        usernameInput.setAttribute("disabled", true)
    }
    if (passwordInput) {
        passwordInput.parentElement.setAttribute("disabled", true)
        passwordInput.setAttribute("disabled", true)
    }
    if (confirmPassword) {
        confirmPassword.parentElement.setAttribute("disabled", true)
        confirmPassword.setAttribute("disabled", true)
    }
    if (emailInput) {
        emailInput.parentElement.setAttribute("disabled", true)
        emailInput.setAttribute("disabled", true)
    }
    if (codeInput) {
        codeInput.parentElement.setAttribute("disabled", true)
        codeInput.setAttribute("disabled", true)
    }
}
export function unDisableButtons() {
    if (usernameInput) {
        usernameInput.parentElement.removeAttribute("disabled", true)
        usernameInput.removeAttribute("disabled", true)
    }
    if (passwordInput) {
        passwordInput.parentElement.removeAttribute("disabled", true)
        passwordInput.removeAttribute("disabled", true)
    }
    if (confirmPassword) {
        confirmPassword.parentElement.removeAttribute("disabled", true)
        confirmPassword.removeAttribute("disabled", true)
    }
    if (emailInput) {
        emailInput.parentElement.removeAttribute("disabled", true)
        emailInput.removeAttribute("disabled", true)
    }
    if (codeInput) {
        codeInput.parentElement.removeAttribute("disabled", true)
        codeInput.removeAttribute("disabled", true)
    }
}

export function hideEl(ID) {
    const el = document.querySelector(`#${ID}`)
    if(el) {
        el.setAttribute("disabled", true)
        el.classList.add("hidden")

        if(el.querySelector("input")) {
            el.querySelector("input").setAttribute("disabled", true)
        }
    }
}
export function showEl(ID) {
    const el = document.querySelector(`#${ID}`)
    if(el) {
        el.removeAttribute("disabled")
        el.classList.remove("hidden")

        if(el.querySelector("input")) {
            el.querySelector("input").removeAttribute("disabled")
        }
    }
}
export function disableEl(ID) {
    const el = document.querySelector(`#${ID}`)
    if(el) {
        el.setAttribute("disabled", true)

        if(el.querySelector("input")) {
            el.querySelector("input").setAttribute("disabled", true)
        }
    }
}
export function unDisableEl(ID) {
    const el = document.querySelector(`#${ID}`)
    if(el) {
        el.removeAttribute("disabled")

        if(el.querySelector("input")) {
            el.querySelector("input").removeAttribute("disabled")
        }
    }
}

export function showErrBlock(text, time = 5000) {
    errorBlock.classList.remove("hidden")
    errorBlock.innerText = text

    setTimeout(() => {
        errorBlock.classList.add("hidden")
    }, time)
}

export function initInputs() {
    if (inputs.length > 0) {
        inputs.forEach(input => {
            input.addEventListener("input", (e) => {
                if (e.target.value.length > 0) {
                    input.classList.add("focused")
                }
                else {
                    input.classList.remove("focused")
                }
            })
        })
    }
}

export function transition(callback) {
    setTimeout(() => {
        userFormWrapper.style.opacity = 0
        userFormWrapper.style.pointerEvents = "none"
    }, 0)

    setTimeout(() => {
        if(callback) callback()
        userFormWrapper.style.opacity = 1
        userFormWrapper.style.pointerEvents = "all"
    }, 500)
}

// Add a visibility toggle to password inputs

document.addEventListener("DOMContentLoaded", async () => {
    const gls = await GLS.init()

    if(document.querySelector("#alreadyHaveAccount")) document.querySelector("#alreadyHaveAccount").textContent = gls.get("auth.alreadyHaveAnAccount")
    if(document.querySelector("#howToRegisterOrg")) document.querySelector("#howToRegisterOrg").textContent = gls.get("auth.howToRegOrganization")
    if(document.querySelector("#registerNewAccount")) document.querySelector("#registerNewAccount").textContent = gls.get("auth.registerNewAccount")
    if(document.querySelector("#skipAccountCreation")) document.querySelector("#skipAccountCreation").textContent = gls.get("auth.skipAccountCreation")
    if(document.querySelector("#help")) document.querySelector("#help").textContent = gls.get("help")

    // transition between pages
    setTimeout(() => {
        userFormWrapper.style.opacity = 1
    }, 0)

    document.querySelectorAll("a[href]").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault()

            userFormWrapper.style.opacity = 0

            setTimeout(() => {
                window.location = e.target.href
            }, 200)
        })
    })
    // 

    inputs.forEach(i => {
        if (i.type === "password") {
            function handleEye({ isVisible, eyeIcon }) {
                if (isVisible) {
                    i.type = "text"
                    eyeIcon.textContent = "visibility_off"
                } else {
                    i.type = "password"
                    eyeIcon.textContent = "visibility"
                }
            }

            const wrapper = document.createElement("div")
            let isVisible = false

            const eyeIcon = document.createElement("span")
            eyeIcon.classList.add("material-symbols-rounded", "auth-visibility__change")

            handleEye({ isVisible, eyeIcon })

            eyeIcon.addEventListener("click", () => {
                isVisible = !isVisible
                handleEye({ isVisible, eyeIcon })
            })

            wrapper.appendChild(eyeIcon)
            i.parentElement.appendChild(wrapper)
        }
    })

    //

    window.electron.onAuthMsg((data) => {
        const content = data.content
        const type = data.type

        if (type == "err") {
            showErrBlock(content)
        }
    })

    if (document.querySelector("#skipAccountCreation")) {
        document.querySelector("#skipAccountCreation").addEventListener("click", () => {
            window.electron.setNonAccountMode(true)
            window.electron.reload()
        })
    }
})