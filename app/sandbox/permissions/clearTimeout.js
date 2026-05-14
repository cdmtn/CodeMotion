function callback(data) {
    clearTimeout(data.selfArgs[0])
}

module.exports = { callback }
