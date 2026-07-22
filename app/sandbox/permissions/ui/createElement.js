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

    const allowedImageFormats = ["gif", "png", "jpg", "jpeg", "svg"]

    const c = createSandboxConsole(extName, debuggerSender)

    const list = {}

    function createElement(type) {
        const id = crypto.randomUUID()
        const events = {}

        function genObj(object) {
            return {
                id: id,
                extName: extName,
                ...object
            }
        }

        list[id] = {}

        mainSender.send("extension-create-element", genObj({
            type: type
        }))

        const properties = {
            on: (eventName, callback) => {
                if (typeof eventName != "string") {
                    c.error(`[${type}:on] Event name must be a string`)
                }
                if (typeof callback != "function") {
                    c.error(`[${type}:on] Callback must be a function`)
                }

                mainSender.send("extension-mod-element", genObj({
                    type: "onEvent",
                    value: eventName,
                }))

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

                mainSender.send("extension-mod-element", genObj({
                    type: "setSize",
                    value: {
                        availableSizes: sizes,
                        sizes: object
                    },
                }))

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

                mainSender.send("extension-mod-element", genObj({
                    type: "setPosition",
                    value: {
                        availablePositions: positions,
                        positions: object
                    }
                }))

                list[id]["position"] = object
            }
        }

        if(type == "image") {
            properties["src"] = (srcPath) => {
                const srcBase = srcPath.split("?")[0]
                if(!allowedImageFormats.includes(srcBase.split(".").pop())) {
                    c.error(`[${type}:src] This image format is not supported. Supported formats: ${allowedImageFormats.join(", ")}`)
                }

                const query = srcPath.includes("?") ? "?" + srcPath.split("?")[1] : ""
                const p = path.join(extPath, srcBase) + query

                mainSender.send("extension-mod-element", genObj({
                    type: "setSrc",
                    value: p,
                }))

                list[id]["src"] = p
            }
        }

        if(type == "topbarItem") {
            properties["setup"] = (properties = {}) => {
                if("image" in properties) {
                    const imgBase = properties.image.split("?")[0]
                    const imgQuery = properties.image.includes("?") ? "?" + properties.image.split("?")[1] : ""
                    if(!allowedImageFormats.includes(imgBase.split(".").pop())) {
                        c.error(`[${type}:setup:image] This image format is not supported. Supported formats: ${allowedImageFormats.join(", ")}`)
                    }
                    properties.image = path.join(extPath, imgBase) + imgQuery
                }

                mainSender.send("extension-mod-element", genObj({
                    type: "setTopbarItemSetup",
                    value: properties,
                }))

                list[id]["properties"] = properties
            }
            properties["hide"] = () => {
                mainSender.send("extension-mod-element", genObj({
                    type: "setTopbarItemHide"
                }))
            }
            properties["hideText"] = () => {
                mainSender.send("extension-mod-element", genObj({
                    type: "setTopbarItemHideWithIcon"
                }))
            }
            properties["show"] = () => {
                mainSender.send("extension-mod-element", genObj({
                    type: "setTopbarItemShow"
                }))
            }
            properties["on"] = (eventName, callback = () => {}) => {
                mainSender.send("extension-mod-element", genObj({
                    type: "setTopbarItemEvent",
                    value: eventName
                }))

                events[eventName] = callback

                list[id]["events"] = events
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
        image: createElement("image"),
        topbarItem: createElement("topbarItem")
    }

    if(elType in elements) {
        return () => {
            return elements[elType]
        }
    }
}

module.exports = { callback }