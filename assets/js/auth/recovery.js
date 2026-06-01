import {
    submitBtn,
    usernameInput,
    emailInput,
    passwordInput,
    codeInput,
    errorBlock,
    disableButtons,
    unDisableButtons,
    showErrBlock,
    getFormLabel,
    initInputs,
    transition,

    hideEl,
    showEl,
    disableEl,
    unDisableEl
} from "./authRenderer.js"

import { createNotify, GLS, secondsToMinutes } from "../lib.js"

const submitBtnID = "recoverySubmitBtn"

function renderVeryCodeStep({ email, gls, descEl }) {
    showEl("code_field")

    const submitCodeBtn = submitBtn.cloneNode()
    submitCodeBtn.textContent = gls.get("auth.recovery.verifyCodeBtn")

    descEl.textContent = gls.get("auth.recovery.description_code")

    document.querySelector(".user-form__inputs").appendChild(submitCodeBtn)

    submitCodeBtn.addEventListener("click", async () => {
        disableEl(submitBtnID)
        const codeValue = codeInput.value.replaceAll(/\s/gm, "")

        const res = await window.electron.verifyRecoveryCode(email, codeValue)
        
        if(res.success) {
            transition(() => {
                unDisableEl(submitBtnID)
                
                renderPasswordResetStep({
                    email: email,
                    gls: gls,
                    descEl: descEl,
                    verifyCodeBtn: submitCodeBtn,
                    codeInput: codeInput,
                    minutes: secondsToMinutes(res.result.expiresIn),
                    token: res.result.token
                })
            })
        }
        else {
            showErrBlock(res.result)
        }
    })

    emailInput.parentElement.remove()
    submitBtn.remove()
}

function renderPasswordResetStep({ email, gls, descEl, verifyCodeBtn, codeInput, minutes, token }) {
    hideEl("code_field")
    showEl("newpass_field")

    const resetPasswordBtn = verifyCodeBtn.cloneNode()
    resetPasswordBtn.textContent = gls.get("auth.recovery.newPassBtn")

    const newPasswordInput = document.querySelector("#newpass")
    getFormLabel(newPasswordInput).textContent = gls.get("auth.recovery.inputs.newpass")

    descEl.textContent = gls.get("auth.recovery.description_newpass", { minutes: minutes })

    document.querySelector(".user-form__inputs").appendChild(resetPasswordBtn)

    resetPasswordBtn.addEventListener("click", async () => {
        disableEl(submitBtnID)
        const newPasswordValue = newPasswordInput.value

        const res = await window.electron.resetPassword(token, newPasswordValue)
        
        if(res.success) {
            transition(() => {
                unDisableEl(submitBtnID)

                const toLoginPageBtn = resetPasswordBtn.cloneNode()
                toLoginPageBtn.textContent = gls.get("auth.recovery.toLoginPageBtn")
                document.querySelector(".user-form__inputs").appendChild(toLoginPageBtn)

                descEl.textContent = gls.get("auth.recovery.description_newpass_success")

                toLoginPageBtn.addEventListener("click", () => {
                    transition(() => {
                        window.location = "login.html"
                    })
                })

                document.querySelector("#newpass_field").remove()
                document.querySelector(".form-submit").remove()
            })
        }
        else {
            showErrBlock(res.result)
        }
    })

    codeInput.parentElement.remove()
    verifyCodeBtn.remove()
}

document.addEventListener("DOMContentLoaded", async () => {
    const gls = await GLS.init()

    const descEl = document.querySelector(".user-logo__desc")
    const titleEl = document.querySelector(".user-logo__title")

    initInputs()

    getFormLabel(emailInput).textContent = gls.get("auth.recovery.inputs.email")
    getFormLabel(codeInput).textContent = gls.get("auth.recovery.inputs.code")

    submitBtn.textContent = gls.get("auth.recovery.submitBtn")

    titleEl.textContent = gls.get("auth.recovery.title")
    descEl.textContent = gls.get("auth.recovery.description")

    submitBtn.addEventListener("click", async () => {
        let email = emailInput.value

        disableEl(submitBtnID)

        const res = await window.electron.requestRecoveryCode(email)

        if(res.success) {
            errorBlock.classList.add("hidden")

            codeInput.parentElement.removeAttribute("disabled")
            codeInput.removeAttribute("disabled")

            createNotify(
                {
                    type: "success",
                    icon: "check",
                    title: gls.get("auth.recovery.successNotification.title"),
                    content: gls.get("auth.recovery.successNotification.description", { email: email })
                }
            )

            transition(() => {
                unDisableEl(submitBtnID)
                renderVeryCodeStep({ email: email, gls: gls, descEl: descEl })
            })
        }
        else {
            showErrBlock(res.result)
        }
    })
})