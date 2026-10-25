import { app } from "electron"
import fs from "fs"
import path from "path"
import fsPromise from "fs/promises"
import https from "https"
import type { IncomingMessage } from "http"
import {
    SETTINGS_PATH,
    LOCAL_BUGS_PATH,
    LOCAL_FILE_PATH,
    PACKAGE_FILE_PATH,
    DEFAULT_ICON,
    ASSETS_PATH,
    LANGUAGES_PATH,
    API
} from "./paths"

function deepMerge(target: any, source: any): any {
    if (!source || typeof source !== "object") return target;

    for (const key of Object.keys(source)) {
        const srcVal = source[key];
        const tgtVal = target[key];

        if (
            srcVal &&
            typeof srcVal === "object" &&
            !Array.isArray(srcVal) &&
            tgtVal &&
            typeof tgtVal === "object" &&
            !Array.isArray(tgtVal)
        ) {
            target[key] = deepMerge({ ...tgtVal }, srcVal);
        } else {
            target[key] = srcVal;
        }
    }

    return target;
}
function readSettings(): any {
    try {
        if (!fs.existsSync(SETTINGS_PATH)) {
            return {};
        }

        const raw = fs.readFileSync(SETTINGS_PATH, "utf8").trim();
        if (!raw) return {};

        return JSON.parse(raw);
    } catch (err) {
        console.error("Error reading settings.json:", err);
        return {};
    }
}
function writeLocalBugs(data: any): void {
    try {
        fs.writeFileSync(LOCAL_BUGS_PATH, JSON.stringify(data, null, 4), "utf-8")
    } catch (e) {
        console.error("Write error:", e)
    }
}

function writeSettings(data: any): any {
    const current = readSettings() || {};

    const merged = deepMerge({ ...current }, data);

    try {
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf8");
    } catch (err) {
        console.error("Error writing settings.json:", err);
    }

    return merged;
}
function writeLocal(data: any): any {
    const current = getLocalAppData() || {};

    const merged = deepMerge({ ...current }, data);

    try {
        fs.writeFileSync(LOCAL_FILE_PATH, JSON.stringify(merged, null, 2), "utf8");
    } catch (err) {
        console.error("Error writing local.json:", err);
        return false
    }

    return merged;
}
function ensureLocalJson(): void {
    if (!fs.existsSync(LOCAL_FILE_PATH)) {
        const defaultData = {
            user: false,
            password: false
        };
        fs.writeFileSync(LOCAL_FILE_PATH, JSON.stringify(defaultData, null, 4), "utf-8");
    }
}
function ensureSettingsJson(): void {
    if (!fs.existsSync(SETTINGS_PATH)) {
        const defaultData = {
            "app": {
                "icon": "default",
                "workSeconds": 0,
                "workSecondsSession": 0,
                "devMode": false,
                "splashScreen": true,
                "uiScale": 1,
                "language": "en",
                "restoreFolder": true,
                "useSystemNotifications": process.platform !== "win32"
            },
            "editor": {
                "coloredComments": true
            }
        }

        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(defaultData, null, 4), "utf-8");
    }
}
function ensureLocalBugs(): void {
    if (!fs.existsSync(LOCAL_BUGS_PATH)) {
        fs.writeFileSync(LOCAL_BUGS_PATH, "[]", "utf-8");
    }
}
function getLocalAppData(): any {
    try {
        const data = fs.readFileSync(LOCAL_FILE_PATH, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error while reading ${LOCAL_FILE_PATH}:`, err);
        return { user: false, password: false };
    }
}
function getSettingsData(): any {
    try {
        const data = fs.readFileSync(SETTINGS_PATH, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error while reading ${SETTINGS_PATH}`, err);
        return {};
    }
}
function getLocalBugsData(): any {
    try {
        const data = fs.readFileSync(LOCAL_BUGS_PATH, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error while reading ${LOCAL_BUGS_PATH}:`, err);
        return {};
    }
}
function getPackageData(): any {
    try {
        const data = fs.readFileSync(PACKAGE_FILE_PATH, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error while reading ${PACKAGE_FILE_PATH}:`, err);
        return {};
    }
}
async function getAppIcon(): Promise<string> {
    const settings = await readSettings()

    if ("app" in settings) {
        if ("icon" in settings.app) {
            const appIcon = settings.app.icon == "default"
                ? DEFAULT_ICON
                : path.join(ASSETS_PATH, "media", "app-icons", `codemotion-icon-${settings.app.icon}.png`)

            return appIcon
        }
        else {
            return DEFAULT_ICON
        }
    }
    else {
        return DEFAULT_ICON
    }
}
function readFilesInFolder(folderPath: string): any[] {
    const base = path.isAbsolute(folderPath)
        ? folderPath
        : path.join(app.getAppPath(), folderPath);

    if (!fs.existsSync(base)) {
        return [];
    }

    return fs.readdirSync(base).map(file => {
        const fullPath = path.join(base, file);
        const isDir = fs.statSync(fullPath).isDirectory();

        return {
            name: file,
            path: fullPath,
            type: isDir ? "folder" : "file"
        };
    });
}
async function readFileContent(filePath: string, encoding: BufferEncoding | null = 'utf8'): Promise<string | Buffer> {
    const abs = path.isAbsolute(filePath)
        ? filePath
        : path.join(app.getAppPath(), filePath);

    const data = await fsPromise.readFile(abs, { encoding: encoding === null ? undefined : encoding });
    return data;
}
function updateLocalAppData(newData: any): void {
    const filePath = LOCAL_FILE_PATH;

    let currentData: any = {};
    if (fs.existsSync(filePath)) {
        try {
            const raw = fs.readFileSync(filePath, "utf-8");
            currentData = JSON.parse(raw);
        } catch (e) {
            console.error("local.json read error:", e);
        }
    }

    const updatedData = { ...currentData, ...newData };

    try {
        fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 4), "utf-8");
        console.log("local.json updated")
    } catch (e) {
        console.error("Error while updating local.json:", e);
    }
}
async function checkStatus({ updateSplash }: { updateSplash: (message: string, isError?: boolean) => void }): Promise<boolean> {
    function checkURL(url: string, stepName: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const req = https.get(url, (res: IncomingMessage) => {
                if (res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 400) {
                    updateSplash(`${stepName}: OK (${res.statusCode})`)
                    res.resume();
                    resolve(true);
                } else {
                    reject(new Error(`${stepName} returned status ${res.statusCode}`));
                }
            });

            req.on("error", (err) => {
                reject(new Error(`${stepName} not aviable: (${err.message})`));
            });

            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error(`${stepName}: connection timeout`));
            });
        });
    }

    updateSplash("Internet check...")

    try {
        await checkURL("https://www.gstatic.com/generate_204", "Internet");
    } catch (err: any) {
        updateSplash(`Error: ${err.message}`, true)

        throw new Error("Error: " + err.message);
    }

    const hosts = [
        { name: "API Server", url: API }
    ];

    for (let i = 0; i < hosts.length; i++) {
        const { name, url } = hosts[i];

        updateSplash(`Requesting ${url}...`)

        try {
            await checkURL(url, name);
        } catch (err: any) {
            throw new Error(`${name} not aviable: ${err.message}`);
        }
    }

    updateSplash("Everything is okey. Starting the program...")

    return true;
}
async function getAllLanguages(): Promise<string[] | Record<string, never>> {
    if(fs.existsSync(LANGUAGES_PATH)) {
        try {
            const files = await fs.promises.readdir(LANGUAGES_PATH)
            const result: string[] = []

            for (const file of files) {
                const fullPath = path.join(LANGUAGES_PATH, file)
                const stat = await fs.promises.stat(fullPath)

                if (stat.isFile()) {
                    const name = file.split(".")[0].trim()
                    result.push(name)
                }
            }

            return result
        } catch (err) {
            console.error("getAllLanguages error:", err)
            return {}
        }
    }
    else {
        return {}
    }
}

async function getAllLanguagesJSON(): Promise<Record<string, any>> {
    const languages = await getAllLanguages()
    let result: Record<string, any> = {}

    if(Array.isArray(languages) && languages.length > 0) {
        languages.forEach(language => {
            try {
                const data = fs.readFileSync(path.join(LANGUAGES_PATH, language + ".json"), 'utf8');
                result[language] = JSON.parse(data)
            } catch (error) {}
        })
    }

    return result
}
async function getUserToken(): Promise<any> {
    if(fs.existsSync(LOCAL_FILE_PATH)) {
        try {
            let data: any = fs.readFileSync(LOCAL_FILE_PATH, 'utf8');
            data = JSON.parse(data)

            if("token" in data) {
                return data.token
            }
            else {
                return false
            }
        }
        catch {
            return false
        }
    }
}

async function requestAddBug({ title = "Unnamed", description = "No description provided", priority = 0, isPrivate = 0, assignTo = 0 }: { title?: string; description?: string; priority?: number; isPrivate?: number; assignTo?: number }): Promise<{ success: boolean; msg: any }> {
    const userToken = await getUserToken()

    const formData = new FormData();
    formData.append('name', title);
    formData.append('description',  description);
    formData.append('priority', String(priority));
    formData.append('private', String(isPrivate));

    if(assignTo != 0) {
        formData.append('touserid', String(assignTo));
    }

    console.log(`Request bug creation. assign to: ${assignTo} (allowed: ${assignTo != 0})`)

    try {
        const response = await fetch(`${API}/bug/add`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`
            },
            body: formData
        });

        const data: any = await response.json();

        if (data.success) {
            return { success: true, msg: data.result }
        } else {
            return { success: false, msg: data.result }
        }
    } catch (error) {
        return { success: false, msg: error }
    }
}

async function requestMakeVerifyBug({ bugid }: { bugid: any }): Promise<{ success: boolean; msg: any }> {
    const userToken = await getUserToken()

    const formData = new FormData();
    formData.append('bugid', String(bugid));

    try {
        const response = await fetch(`${API}/bug/makeVerify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`
            },
            body: formData
        });

        const data: any = await response.json();

        if (data.success) {
            return { success: true, msg: data.result }
        } else {
            return { success: false, msg: data.result }
        }
    } catch (error) {
        return { success: false, msg: error }
    }
}

async function requestGetYourOrgColleagues(): Promise<{ success: boolean; msg: any }> {
    const userToken = await getUserToken()

    try {
        const response = await fetch(`${API}/org/getYourColleagues`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`
            },
            body: {} as any
        });

        const data: any = await response.json();

        if (data.success) {
            return { success: true, msg: data.result }
        } else {
            return { success: false, msg: data.result }
        }
    } catch (error) {
        return { success: false, msg: error }
    }
}

async function requestCreateOrganization({ name, description, website }: { name: string; description: string; website: string }): Promise<{ success: boolean; msg: any }> {
    const userToken = await getUserToken()

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('website', website);

    try {
        const response = await fetch(`${API}/org/create`, {
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
}

async function requestExploreOrganizations(): Promise<{ success: boolean; msg: any }> {
    const userToken = await getUserToken()

    try {
        const response = await fetch(`${API}/org/explore`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`
            },
            body: {} as any
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
}

async function getUsedLanguagesByPath(targetPath: string): Promise<any> {
    const languages: Record<string, { name: string; extensions: string[]; color: string }> = {
        js: {
            name: "JavaScript",
            extensions: [
                ".js",
                ".mjs",
                ".cjs",
                ".jsx",
                ".es6"
            ],
            color: "#FFCC33"
        },

        ts: {
            name: "TypeScript",
            extensions: [
                ".ts",
                ".mts",
                ".cts",
                ".tsx"
            ],
            color: "#3178c6"
        },

        html: {
            name: "HTML",
            extensions: [
                ".html",
                ".htm",
                ".xhtml"
            ],
            color: "#FF6933"
        },

        css: {
            name: "CSS",
            extensions: [
                ".css",
                ".scss",
                ".sass",
                ".less"
            ],
            color: "#3388FF"
        },

        json: {
            name: "JSON",
            extensions: [
                ".json",
                ".jsonc",
                ".json5"
            ],
            color: "#FF8B33"
        },

        php: {
            name: "PHP",
            extensions: [
                ".php",
                ".phtml",
                ".php3",
                ".php4",
                ".php5",
                ".phps",
                ".inc"
            ],
            color: "#8692ff"
        },

        go: {
            name: "Go",
            extensions: [
                ".go"
            ],
            color: "#62daff"
        }
    }

    const extensionMap = Object.entries(languages).reduce((acc: Record<string, string>, [key, lang]) => {
        for (const ext of lang.extensions) {
            acc[ext] = key
        }
        return acc
    }, {})

    const IGNORED_DIRS = new Set([
        "node_modules",
        ".git",
        "dist",
        "build",
        ".next",
        "out",
        "package.json",
        "package-lock.json",
        "LICENSE",
        ".gitignore",
        "README.md"
    ])

    if (!path.isAbsolute(targetPath)) {
        throw new Error("Path must be absolute")
    }

    const counts: Record<string, number> = {}
    let knownFiles = 0
    let unknownFiles = 0

    async function scan(dir: string): Promise<void> {
        let entries

        try {
            entries = await fsPromise.readdir(dir, { withFileTypes: true })
        } catch {
            return
        }

        const tasks: Promise<void>[] = []

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)

            if (entry.isDirectory()) {
                if (!IGNORED_DIRS.has(entry.name)) {
                    tasks.push(scan(fullPath))
                }
                continue
            }

            if (!entry.isFile()) continue

            const ext = path.extname(entry.name).toLowerCase()
            const langKey = extensionMap[ext]

            if (langKey) {
                counts[langKey] = (counts[langKey] || 0) + 1
                knownFiles++
            } else {
                unknownFiles++
            }
        }

        await Promise.all(tasks)
    }

    await scan(targetPath)

    const totalFiles = knownFiles + unknownFiles

    const result = Object.entries(languages).map(([key, lang]) => {
        const files = counts[key] || 0

        return {
            key,
            name: lang.name,
            color: lang.color,
            files,
            percentage: totalFiles
                ? Math.round((files / totalFiles) * 100)
                : 0
        }
    })

    const unknownPercentage = totalFiles
        ? Math.round((unknownFiles / totalFiles) * 100)
        : 0

    return {
        languages: result,
        unknown: {
            files: unknownFiles,
            percentage: unknownPercentage
        },
        totalFiles
    }
}

export {
    readSettings,
    deepMerge,
    writeLocalBugs,
    writeSettings,
    writeLocal,
    ensureLocalJson,
    ensureSettingsJson,
    ensureLocalBugs,
    getLocalAppData,
    getSettingsData,
    getLocalBugsData,
    getPackageData,
    getAppIcon,
    readFilesInFolder,
    readFileContent,
    updateLocalAppData,
    checkStatus,
    getAllLanguages,
    getAllLanguagesJSON,
    getUserToken,
    requestAddBug,
    requestMakeVerifyBug,
    requestGetYourOrgColleagues,
    getUsedLanguagesByPath,
    requestCreateOrganization,
    requestExploreOrganizations
}
