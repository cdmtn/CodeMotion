const host = "https://codemotion.yurba.one/api";

export class _GetOrgAvatar {
    static async get(id, size = "default") {
        const url = `${host}/media/org-avatar/${id}.jpg?s=${size}&v=${Math.floor(Math.random() * 99999)}`;

        try {
            const response = await fetch(url, {
                method: "HEAD",
                cache: "no-cache",
            });

            return response.ok ? url : false;
        } catch {
            return false;
        }
    }
}