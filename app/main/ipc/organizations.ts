import { ipcMain, IpcMainInvokeEvent } from "electron"
import { getUserToken, requestCreateOrganization, requestExploreOrganizations, requestGetYourOrgColleagues } from "../helpers/requests"
import { API } from "../helpers/paths"

ipcMain.handle("create-organization", async (_: IpcMainInvokeEvent, params: any) => {
    return await requestCreateOrganization(params)
})
ipcMain.handle("request-get-your-org-colleagues", async (_: IpcMainInvokeEvent) => {
    return await requestGetYourOrgColleagues()
})
ipcMain.handle("get-explore-organizations", async () => {
    return await requestExploreOrganizations()
})
ipcMain.handle('get-org-data-from-api', async (_: IpcMainInvokeEvent, orgID: number) => {
    const userToken = await getUserToken()

    try {
        const response = await fetch(`${API}/getOrg.php?id=${orgID}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });

        const data: any = await response.json()

        if (data.success) {
            return { success: true, msg: data.result }
        } else {
            return { success: false, msg: data.result }
        }
    } catch (error) {
        return { success: false, msg: error }
    }
})
ipcMain.handle('remove-org', async (_: IpcMainInvokeEvent, orgID: number) => {
    const userToken = await getUserToken()
    const formData = new FormData();
    formData.append('id', orgID);

    try {
        const response = await fetch(`${API}/organizations/removeOrg.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`
            },
            body: formData
        });

        const data: any = await response.json()

        if (data.success) {
            return { success: true, msg: data.result }
        } else {
            return { success: false, msg: data.result }
        }
    } catch (error) {
        return { success: false, msg: error }
    }
})
ipcMain.handle('join-org', async (_: IpcMainInvokeEvent, inviteCode: string) => {
    const userToken = await getUserToken()
    const formData = new FormData();
    formData.append('invite_code', inviteCode);

    try {
        const response = await fetch(`${API}/organizations/joinOrg.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({
                "invite_code": inviteCode
            })
        });

        const data: any = await response.json()

        if (data.success) {
            return { success: true, msg: data.result }
        } else {
            return { success: false, msg: data.result }
        }
    } catch (error) {
        return { success: false, msg: error }
    }
})
ipcMain.handle('reset-org-invite-code', async (_: IpcMainInvokeEvent, orgid: number) => {
    const userToken = await getUserToken()
    const formData = new FormData();
    formData.append('org_id', orgid);

    try {
        const response = await fetch(`${API}/organizations/resetInviteCode.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`
            },
            body: formData
        });

        const data: any = await response.json()

        if (data.success) {
            return { success: true, msg: data.result }
        } else {
            return { success: false, msg: data.result }
        }
    } catch (error) {
        return { success: false, msg: error }
    }
})