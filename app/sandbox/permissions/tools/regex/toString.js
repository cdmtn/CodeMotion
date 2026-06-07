function callback(data) {
    const regex = data.selfArgs[0]
    let source = regex instanceof RegExp ? regex.source : String(regex);

    return () => {
        source = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        source = source.slice(1)
        source = source.slice(0, -1)
        return source
    };
}

module.exports = { callback }