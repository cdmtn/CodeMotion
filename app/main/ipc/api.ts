import { ipcMain } from "electron";
import { readFileContent } from "../helpers/requests";
import { API, LOCAL_FILE_PATH } from "../helpers/paths";

ipcMain.handle('get-user-data-from-api', async () => {
    let localData: any = await readFileContent(LOCAL_FILE_PATH)
    localData = JSON.parse(localData)

    let api = `${API}/getMe.php`

    try {
        const response = await fetch(api, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${localData.token}`
            }
        });
        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                result: result
            }
        }
        
        return {
            success: true,
            result: result
        }
    } catch (error: unknown) {
        return {
            success: false,
            result: String(error),
        }
    }
})