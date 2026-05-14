export class _Dirs {
    static dirs = {
        default: {
            icon: "default",
            iconExt: "svg"
        },
        js: {
            icon: "js",
            iconExt: "svg"
        },
        javascript: {
            icon: "js",
            iconExt: "svg"
        },
        fonts: {
            icon: "fonts",
            iconExt: "svg"
        },
        font: {
            icon: "fonts",
            iconExt: "svg"
        },
        json: {
            icon: "json",
            iconExt: "svg"
        },
        css: {
            icon: "css",
            iconExt: "svg"
        },
        styles: {
            icon: "css",
            iconExt: "svg"
        },
        style: {
            icon: "css",
            iconExt: "svg"
        },
        plugins: {
            icon: "plugins",
            iconExt: "svg"
        },
        extensions: {
            icon: "plugins",
            iconExt: "svg"
        },
        assets: {
            icon: "assets",
            iconExt: "svg"
        },
        media: {
            icon: "assets",
            iconExt: "svg"
        },
        static: {
            icon: "assets",
            iconExt: "svg"
        },
        public: {
            icon: "assets",
            iconExt: "svg"
        },
        svg: {
            icon: "svg",
            iconExt: "svg"
        },
        icons: {
            icon: "svg",
            iconExt: "svg"
        }
    }

    static getIcon(name) {
        if(name in this.dirs) {
            if("customIcon" in this.dirs[name]) {
                return this.dirs[name].icon
            }

            return `../assets/media/icons/folders/${this.dirs[name].icon}.${this.dirs[name].iconExt}`
        }
        else {
            return `../assets/media/icons/folders/${this.dirs["default"].icon}.${this.dirs["default"].iconExt}`
        }
    }

    static add({ id, icon, ext, custom }) {
        const dirID = id == undefined ? crypto.randomUUID() : id
        const dirIcon = icon
        const dirExt = ext == undefined ? "svg" : ext
        const customIcon = custom == undefined ? false : custom

        this.dirs[dirID] = {
            icon: dirIcon,
            iconExt: dirExt,
            customIcon: customIcon
        }
    }

    static list() {
        return this.dirs
    }
}