const { getExt, isFileExists, createSandboxConsole, resolveSandboxPath } = require("../../tools")

function callback(data) {
    const audioFilePath = data.selfArgs[0]
    const audioProperties = data.selfArgs[1]

    const fileExt = getExt(audioFilePath)
    const extPath = data.extensionPath
    const extName = data.extensionName
    const debuggerSender = data.debuggerSender
    const mainSender = data.mainSender
    const permName = data.permissionName

    const c = createSandboxConsole(extName, debuggerSender)
    
    const aviableExts = [".mp3", ".wav"]

    if(typeof audioProperties != "object" || Array.isArray(audioProperties)) {
        c.error(`[${permName}]: Audio properties must be object`)
        return
    }

    let volume = audioProperties.volume == undefined ? 0.2 : audioProperties.volume
    let speed = audioProperties.speed == undefined ? 1 : audioProperties.speed

    if (volume > 0.8) volume = 0.2
    if (volume < 0.2) volume = 0.2

    if (speed > 4) speed = 1
    if (speed < 0.5) speed = 1

    if(aviableExts.includes(fileExt)) {
        const fullAudioPath = resolveSandboxPath(extPath, audioFilePath)
        const isAudioFound = isFileExists(fullAudioPath)

        if(!isAudioFound) {
            c.error(`[${permName}]: File "${fullAudioPath}" not found`)
            return
        }
        else {
            mainSender.send("extension-play-sound", 
                {
                    path: fullAudioPath,
                    volume: volume,
                    speed: speed
                }
            )
        }
    }
}

module.exports = { callback }