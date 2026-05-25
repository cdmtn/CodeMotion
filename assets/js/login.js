import {
    inputs,
    submitBtn,
    usernameInput,
    emailInput,
    passwordInput,
    errorBlock,
    disableButtons,
    unDisableButtons,
    showErrBlock,
    getFormLabel
} from "../components/authRenderer.js"

import { GLS } from "./lib.js"

document.addEventListener("DOMContentLoaded", async () => {
    const gls = await GLS.init()

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

    const params = new URLSearchParams(window.location.search)

    getFormLabel(emailInput).textContent = gls.get("auth.login.inputs.email")
    getFormLabel(passwordInput).textContent = gls.get("auth.login.inputs.password")
    
    submitBtn.textContent = gls.get("auth.login.inputs.submitBtn")

    document.querySelector(".user-logo__title").textContent = gls.get("auth.login.title")
    document.querySelector(".user-logo__desc").textContent = gls.get("auth.login.description")

    if(params.get("email") != null) {
        emailInput.value = params.get("email")
        emailInput.classList.add("focused")
    }
    if(params.get("password") != null) {
        passwordInput.value = params.get("password")
        passwordInput.classList.add("focused")
    }

    window.electron.oncb("auth-msg", (data) => {
        const type = data.type

        if(type == "error") {
            showErrBlock(data.content)
        }
    })

    submitBtn.addEventListener("click", async () => {
        let email = emailInput.value
        let password = passwordInput.value

        disableButtons()

        let res = await window.electron.login(email, password)
        console.log(res)

        if(res.success) {
            errorBlock.classList.add("hidden")
            await window.electron.reload()
        }
        else {
            showErrBlock(res.result)
        }

        unDisableButtons()
    })
})