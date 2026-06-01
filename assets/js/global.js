/** @type {import("../../app/main/types/global").ElectronAPI} */
export const electronAPI = window.electron

export async function getDirname() {
    let __dirname = await electronAPI.getDirname()
    __dirname = __dirname.replaceAll(/\\/g, "/")

    return __dirname
}
export async function readSettings() {
    return await electronAPI.readSettings()
}
export async function enableDevMode() {
    await electronAPI.setSettings({ app: { devMode: true }})
}
export async function disableDevMode() {
    await electronAPI.setSettings({ app: { devMode: false }})
}