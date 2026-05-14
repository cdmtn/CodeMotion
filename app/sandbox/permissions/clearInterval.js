function callback(data) {
    clearInterval(data.selfArgs[0])
}

module.exports = { callback }
