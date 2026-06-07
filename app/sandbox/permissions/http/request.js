async function callback(data) {
    const properties = data.selfArgs[0]
    const url = properties.url
    const method = properties.method || "GET";
    const headers = properties.headers || {};
    const body = properties.body

    try {
        const options = {
            method,
            headers
        };

        const hasContentType = Object.keys(headers).some(
            k => k.toLowerCase() === "content-type"
        );

        if (body && method !== "GET") {
            options.body = typeof body === "string"
                ? body
                : JSON.stringify(body);

            if (hasContentType) {
                options.headers["Content-Type"] = "application/json";
            }
        }

        const res = await fetch(url, options);

        const text = await res.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }

        return async () => {
            return {
                status: res.status,
                ok: res.ok,
                headers: Object.fromEntries(res.headers.entries()),
                data
            }
        };

    } catch (err) {
        return async () => {
            return {
                ok: false,
                error: err.message
            }
        };
    }
}

module.exports = { callback }