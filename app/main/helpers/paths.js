const { app } = require("electron")
const path = require("path")
const appPath = app.getAppPath()

const HTML_PATH = path.join(appPath, "html")
const JSON_PATH = path.join(appPath, "json")
const ASSETS_PATH = path.join(appPath, "assets")
const APP_PATH = path.join(appPath, "app")
const LANGUAGES_PATH = path.join(appPath, "languages")

const SETTINGS_PATH = path.join(JSON_PATH, "settings.json");
const LOCAL_BUGS_PATH = path.join(JSON_PATH, "bugs.json");
const LOCAL_FILE_PATH = path.join(JSON_PATH, "local.json");
const PACKAGE_FILE_PATH = path.join(appPath, "package.json");

const SPLASH_HTML_PATH = path.join(HTML_PATH, "splash.html")
const INDEX_HTML_PATH = path.join(HTML_PATH, "index.html")
const LOGIN_HTML_PATH = path.join(HTML_PATH, "login.html")
const REGISTER_HTML_PATH = path.join(HTML_PATH, "register.html")

const PRELOAD_PATH = path.join(APP_PATH, "dist", "preload.js")
const RENDERER_PATH = path.join(APP_PATH, "renderer.js")

const DEFAULT_ICON = path.join(ASSETS_PATH, "media", "codemotion_icon.png")

const API = "https://dev.yurba.one/api/pcode"

module.exports = { 
    APP_PATH,
    SETTINGS_PATH,
    LOCAL_BUGS_PATH,
    LOCAL_FILE_PATH,
    PACKAGE_FILE_PATH,
    HTML_PATH,
    JSON_PATH,
    SPLASH_HTML_PATH,
    INDEX_HTML_PATH,
    LOGIN_HTML_PATH,
    REGISTER_HTML_PATH,
    ASSETS_PATH,
    DEFAULT_ICON,
    PRELOAD_PATH,
    RENDERER_PATH,
    LANGUAGES_PATH,
    API
}