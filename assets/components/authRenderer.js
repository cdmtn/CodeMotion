import { GLS } from "../js/lib.js"

export let inputs = document.querySelectorAll("input")
export let submitBtn = document.querySelector(".form-submit")
export let usernameInput = document.querySelector("#username")
export let emailInput = document.querySelector("#email")
export let passwordInput = document.querySelector("#password")
export let confirmPassword = document.querySelector("#confirm_password")
export let errorBlock = document.querySelector(".user-form__error")

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
    if (usernameInput) usernameInput.parentElement.setAttribute("disabled", true)
    if (passwordInput) passwordInput.parentElement.setAttribute("disabled", true)
    if (emailInput) emailInput.parentElement.setAttribute("disabled", true)
}
export function unDisableButtons() {
    if (usernameInput) usernameInput.parentElement.removeAttribute("disabled")
    if (passwordInput) passwordInput.parentElement.removeAttribute("disabled")
    if (emailInput) emailInput.parentElement.removeAttribute("disabled")
}

export function showErrBlock(text, time = 5000) {
    errorBlock.classList.remove("hidden")
    errorBlock.innerText = text
    errorBlock.addEventListener("transitionend", () => {
        setTimeout(() => {
            errorBlock.classList.add("hidden")
        }, time)
    })
    submitBtn.textContent = submitBtnOriginText
}

// Add a visibility toggle to password inputs

document.addEventListener("DOMContentLoaded", async () => {
    const gls = await GLS.init()

    if(document.querySelector("#alreadyHaveAccount")) document.querySelector("#alreadyHaveAccount").textContent = gls.get("auth.alreadyHaveAnAccount")
    if(document.querySelector("#howToRegisterOrg")) document.querySelector("#howToRegisterOrg").textContent = gls.get("auth.howToRegOrganization")
    if(document.querySelector("#registerNewAccount")) document.querySelector("#registerNewAccount").textContent = gls.get("auth.registerNewAccount")
    if(document.querySelector("#skipAccountCreation")) document.querySelector("#skipAccountCreation").textContent = gls.get("auth.skipAccountCreation")
    if(document.querySelector("#help")) document.querySelector("#help").textContent = gls.get("help")

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