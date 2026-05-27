import {
    submitBtn,
    usernameInput,
    emailInput,
    passwordInput,
    confirmPassword,
    errorBlock,
    disableButtons,
    unDisableButtons,
    showErrBlock,
    getFormLabel,
    initInputs
} from "../components/authRenderer.js"

import { createNotify, GLS } from "../js/lib.js"

document.addEventListener("DOMContentLoaded", async () => {
    const gls = await GLS.init()

    initInputs()

    getFormLabel(username).textContent = gls.get("auth.register.inputs.username")
    getFormLabel(email).textContent = gls.get("auth.register.inputs.email")
    getFormLabel(password).textContent = gls.get("auth.register.inputs.password")
    getFormLabel(confirmPassword).textContent = gls.get("auth.register.inputs.repeatPassword")
    
    submitBtn.textContent = gls.get("auth.register.inputs.submitBtn")

    document.querySelector(".user-logo__title").textContent = gls.get("auth.register.title")
    document.querySelector(".user-logo__desc").textContent = gls.get("auth.register.description")

    submitBtn.addEventListener("click", async () => {
        let confirmPasswordInput = document.querySelector("#confirm_password")

        let username = usernameInput.value
        let email = emailInput.value
        let password = passwordInput.value
        let confirmPassword = confirmPasswordInput.value

        disableButtons()

        let res = await window.electron.register(username, email, password, confirmPassword)

        if(res.success) {
            createNotify(
                {
                    type: "success",
                    icon: "check",
                    title: gls.get("auth.register.successNotification.title"),
                    content: gls.get("auth.register.successNotification.description")
                }
            )
            errorBlock.classList.add("hidden")
            window.location.href = `login.html?email=${email}&password=${password}`
        }
        else {
            showErrBlock(res.result)
        }

        unDisableButtons()
    })
})