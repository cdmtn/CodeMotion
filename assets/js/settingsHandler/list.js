import { Setting } from "../settings.js"

export const SETTINGS = [
    {
        id: "splash",
        path: "app.splashScreen",
        control: "switch"
    },
    {
        id: "devMode",
        path: "app.devMode",
        control: "switch",
        reload: true
    },
    {
        id: "coloredTabs",
        path: "editor.coloredTabs",
        control: "switch",
        event: "on-setting-colored-tabs"
    },
    {
        id: "confirmCloseTab",
        path: "editor.confirmCloseTab",
        control: "switch"
    },
    {
        id: "restoreFolder",
        path: "app.restoreFolder",
        control: "switch"
    },
    {
        id: "useSystemNotifications",
        path: "app.useSystemNotifications",
        control: "switch"
    },
    {
        id: "goContextParser",
        path: "editor.goContextParser",
        control: "switch",
        domId: "go_context_parser"
    },
    {
        id: "disableRiskyPermissionWarning",
        path: "extensions.disableRiskyPermissionWarning",
        control: "switch"
    },

    {
        id: "useSystemFonts",
        path: "ui.useSystemFont",
        control: "switch",
        apply: (v, c) => Setting.useSystemFonts(v, c.persist)
    },
    {
        id: "boldFont",
        path: "ui.boldFont",
        control: "switch",
        apply: (v, c) => Setting.boldFont(v, c.persist)
    },
    {
        id: "reduceMotion",
        path: "app.reduceMotion",
        control: "switch",
        apply: (v, c) => Setting.reduceMotion(v, c.persist)
    },
    {
        id: "editorTextSize",
        path: "editor.fontSize",
        control: "range",
        apply: (v, c) => Setting.editorTextSize(v, c.notify, c.persist)
    },
    {
        id: "uiScale",
        path: "app.uiScale",
        control: "range",
        apply: (v, c) => Setting.uiScale(v, c.notify, c.persist)
    },

    {
        id: "theme",
        path: "ui.theme",
        control: "select",
        bind: false,
        apply: (v, c) => Setting.themeSelect(v, c.persist)
    },
    {
        id: "language",
        path: "app.language",
        control: "select",
        bind: false,
        apply: (v, c) => Setting.language(v, c.persist)
    },
    {
        id: "autosave",
        path: "editor.autosave",
        control: "select",
        bind: false,
        apply: (v, c) => Setting.autosave(v, c.persist)
    },
    {
        id: "pythonRunnerMethod",
        path: "editor.pythonRunnerMethod",
        control: "select",
        bind: false,
        apply: (v, c) => Setting.pythonRunnerMethod(v, c.persist)
    },

    {
        id: "githubOAuthLogin",
        control: "action",
        action: () => Setting.githubOAuthStart()
    },
    {
        id: "githubOAuthDisconnect",
        control: "action",
        action: () => Setting.githubOAuthDisconnect()
    },
    {
        id: "githubOAuthUserInfo",
        control: "element"
    },
    {
        id: "githubOAuthPending",
        control: "element"
    },
    {
        id: "gitlabOAuthLogin",
        control: "action",
        action: () => Setting.gitlabOAuthStart()
    },
    {
        id: "gitlabOAuthDisconnect",
        control: "action",
        action: () => Setting.gitlabOAuthDisconnect()
    },
    {
        id: "gitlabOAuthUserInfo",
        control: "element"
    },
    {
        id: "gitlabOAuthPending",
        control: "element"
    }
]