export function gitPage({ lgls }) {
    return {
        name: lgls("gitGithub.title"),
        icon: "commit",
        content: [
            {
                type: "category",
                label: lgls("gitGithub.oauth.category"),
                items: []
            },
            {
                type: "row-clear",
                gap: 10,
                items: [
                    {
                        type: "container",
                        id: "setting_githubOAuthUserInfo"
                    },
                    {
                        type: "container",
                        id: "setting_githubOAuthPending"
                    },
                    {
                        type: "button",
                        title: lgls("gitGithub.oauth.buttons.login"),
                        id: "setting_githubOAuthLogin"
                    },
                    {
                        type: "button",
                        title: lgls("gitGithub.oauth.buttons.disconnect"),
                        id: "setting_githubOAuthDisconnect",
                        class: "danger"
                    }
                ]
            },

            {
                type: "category",
                label: lgls("gitlab.oauth.category"),
                items: []
            },
            {
                type: "row-clear",
                gap: 10,
                items: [
                    {
                        type: "container",
                        id: "setting_gitlabOAuthUserInfo"
                    },
                    {
                        type: "container",
                        id: "setting_gitlabOAuthPending"
                    },
                    {
                        type: "button",
                        title: lgls("gitlab.oauth.buttons.login"),
                        id: "setting_gitlabOAuthLogin"
                    },
                    {
                        type: "button",
                        title: lgls("gitlab.oauth.buttons.disconnect"),
                        id: "setting_gitlabOAuthDisconnect",
                        class: "danger"
                    }
                ]
            }
        ]
    }
}
