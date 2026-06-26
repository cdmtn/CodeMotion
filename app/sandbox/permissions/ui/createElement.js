const { app, ipcMain } = require("electron");
const path = require("node:path");
const { getEl } = require("../../../../assets/js/extensionsHandler/events/ui/onElementMod");
const { ExtensionError, createSandboxConsole } = require("../../tools");

function checkForMatch(originalObject, matchObject) {
    const allowed = new Set(Object.keys(matchObject));
    return Object.keys(originalObject).filter(key => !allowed.has(key));
}

function callback(data) {
    const elType = data.selfArgs[0]
    const mainSender = data.mainSender
    const debuggerSender = data.debuggerSender
    const extName = data.extensionName
    const extPath = data.extensionPath

    const c = createSandboxConsole(extName, debuggerSender)

    const list = {}

    function createElement(type) {
        const id = crypto.randomUUID()
        const events = {}

        list[id] = {}

        mainSender.send("extension-create-element", {
            type: type,
            id: id,
            extName: extName
        })

        const properties = {
            on: (eventName, callback) => {
                if (typeof eventName != "string") {
                    c.error(`[${type}:on] Event name must be a string`)
                }
                if (typeof callback != "function") {
                    c.error(`[${type}:on] Callback must be a function`)
                }

                mainSender.send("extension-mod-element", {
                    id: id,
                    type: "onEvent",
                    value: eventName,
                    extName: extName
                })

                events[eventName] = callback

                list[id]["events"] = events
            },
            setSize: (object) => {
                if (typeof object != "object") {
                    c.error(`[${type}:setSize] Argument 0 must be an object`)
                }

                const sizes = {
                    "width": "width: {v}px",
                    "height": "height: {v}px",
                }

                const sizesMatch = checkForMatch(object, sizes)

                if (sizesMatch.length > 0) {
                    c.error(`[${type}:setSize] Undefined size name(-s): ${sizesMatch.join(", ")}`)
                }

                mainSender.send("extension-mod-element", {
                    id: id,
                    type: "setSize",
                    value: {
                        availableSizes: sizes,
                        sizes: object
                    },
                    extName: extName
                })

                list[id]["size"] = object
            },
            setPosition: (object) => {
                if (typeof object != "object") {
                    c.error(`[${type}:on] Argument 0 must be an object`)
                }

                const positions = {
                    "bottom": "bottom: {v}px",
                    "right": "right: {v}px",
                    "left": "left: {v}px",
                    "top": "top: {v}px"
                }

                const positionsMatch = checkForMatch(object, positions)

                if (positionsMatch.length > 0) {
                    c.error(`[${type}:setPosition] Undefined position name(-s): ${positionsMatch.join(", ")}`)
                }

                mainSender.send("extension-mod-element", {
                    id: id,
                    type: "setPosition",
                    value: {
                        availablePositions: positions,
                        positions: object
                    },
                    extName: extName
                })

                list[id]["position"] = object
            }
        }

        if(type == "image") {
            properties["src"] = (srcPath) => {
                const allowedFormats = ["gif", "png", "jpg", "jpeg"]

                if(!allowedFormats.includes(srcPath.split(".").pop())) {
                    c.error(`[${type}:src] This image format is not supported. Supported formats: ${allowedFormats.join(", ")}`)
                }

                const p = path.join(extPath, srcPath)

                mainSender.send("extension-mod-element", {
                    id: id,
                    type: "setSrc",
                    value: p,
                    extName: extName
                })

                list[id]["src"] = p
            }
        }

        return properties
    }

    // listen to external changes
    ipcMain.on("extension-send-element", (_, object) => {
        const type = object.type
        const id = object.id
        const data = object.data

        const current = list[id]

        if(type == "onEventTriggered" && current) { 
            const eventName = data.eventName

            if(eventName in current.events) {
                current.events[eventName]()
            }
        }
    })

    const elements = {
        image: createElement("image")
    }

    if(elType in elements) {
        return () => {
            return elements[elType]
        }
    }
}

module.exports = { callback }