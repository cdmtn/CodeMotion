import { ipcMain, IpcMainInvokeEvent } from "electron"
import { requestAddBug, requestMakeVerifyBug } from "../helpers/requests"

ipcMain.handle("request-add-bug", async (_: IpcMainInvokeEvent, params: object) => {
    return await requestAddBug(params)
})
ipcMain.handle("request-make-verify-bug", async (_: IpcMainInvokeEvent, params = {}) => {
    return await requestMakeVerifyBug(params)
})