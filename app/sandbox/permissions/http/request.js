function isPrivateUrl(urlString) {
    try {
        const url = new URL(urlString)
        const hostname = url.hostname.toLowerCase()
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return true
        if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true
        if (hostname === '127.0.0.1' || hostname.startsWith('127.')) return true
        if (hostname.startsWith('10.')) return true
        if (hostname.startsWith('172.')) {
            const second = parseInt(hostname.split('.')[1], 10)
            if (second >= 16 && second <= 31) return true
        }
        if (hostname.startsWith('192.168.')) return true
        if (hostname.startsWith('169.254.')) return true
        if (hostname.startsWith('fc00:') || hostname.startsWith('fe80:')) return true
        if (hostname === '0.0.0.0' || hostname === '::' || hostname === '[::]') return true
        return false
    } catch {
        return true
    }
}

async function callback(data) {
    const properties = data.selfArgs[0]
    const url = properties.url
    const method = properties.method || "GET";
    const headers = properties.headers || {};
    const body = properties.body

    try {
        if (isPrivateUrl(url)) {
            throw new Error('Access to private/internal addresses is blocked')
        }
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