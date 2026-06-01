export class _Filenames {
    static filenames = {
        "tsconfig.json": {
            name: "TypeScript Config",
            icon: "tsconfig",
            iconExt: "svg",
            mode: "json",
            color: "#2e70ff"
        },
        "LICENSE": {
            name: "License file",
            icon: "license",
            iconExt: "svg",
            mode: "text",
            color: "#929292"
        },
        "package.json": {
            name: "NPM Package file",
            icon: "npm",
            iconExt: "svg",
            mode: "json",
            color: "#ff2828"
        },
        "package-lock.json": {
            name: "NPM Package file",
            icon: "npm",
            iconExt: "svg",
            mode: "json",
            color: "#ff2828"
        }
    }

    static list() {
        return this.filenames
    }

    static get(name) {
        if (name in this.filenames) {
            return this.filenames[name]
        }
        else {
            return false
        }
    }

    static async getIcon(name) {
        let info = this.get(name)
        let allFilenamesIcons = await window.electron.getAllFilenamesIcons()

        allFilenamesIcons = allFilenamesIcons.map(item => { if (item.type != "folder") return item.name })
        allFilenamesIcons = allFilenamesIcons.filter(item => item != undefined)

        if (name in this.filenames) {
            let fileName = `${this.filenames[name].icon}.${this.filenames[name].iconExt}`

            if (info.customIcon) {
                fileName = this.filenames[name].icon
            }

            if (allFilenamesIcons.includes(fileName)) {
                return fileName
            }
            else {
                return fileName
            }
        }
        else {
            return false
        }
    }

    static async getIconPath(name) {
        let info = this.get(name)
        let icon = await this.getIcon(name)

        if (info.customIcon) {
            return icon
        }
        else if(icon) {
            return `../assets/media/icons/filenames/${icon}`
        }
        else {
            return false
        }
    }
}