function callback(data) {
    const cb = data.selfArgs[0]
    const delay = Number(data.selfArgs[1])

    if (typeof cb !== "function") {
        throw new Error("[APP.setTimeout] First argument must be a function")
    }

    return setTimeout(cb, Number.isFinite(delay) ? delay : 0)
}

module.exports = { callback }
