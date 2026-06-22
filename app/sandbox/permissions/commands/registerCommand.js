const { checkFields } = require("../../tools.js")

function callback(data) {
    const input = data.selfArgs[0]
    const extName = data.extensionName

    checkFields("APP.registerCommand", input, {
        name: "string",
        response: "string"
    })

    if (/\s/g.test(input.name)) {
        throw new Error(`The command cannot contain spaces. Use characters such as "-", "_", etc., instead. Example: ${input.name.replaceAll(/\s/g, "-")}`)
    }
    if (input.name.startsWith("-")) {
        throw new Error(`A command name cannot begin with a hyphen (-) when registering a command, because commands that start with this character may be reserved by the program`)
    }

    data.debuggerSender.send("debug-event", {
        data: {
            type: "newCommand",
            command: {
                name: input.name,
                arguments: input.arguments,
                response: input.response
            },
            from: extName
        },
        time: Date.now()
    })
}

module.exports = { callback }