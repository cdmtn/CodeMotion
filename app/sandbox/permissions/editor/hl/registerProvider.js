const { setAceChangedCallback } = require("../../../../dist/ipc/ace.js");
const { getAceTriggeredData } = require("../__api.js")

const providers = new Map();

function registerProvider(id, cb) {
    providers.set(id, cb);
}

function callback(data) {
    const providerID = data.selfArgs[0];
    const cb = data.selfArgs[1];
    const mainSender = data.mainSender;

    registerProvider(providerID, cb)

    if (typeof cb !== "function") return;

    setAceChangedCallback((editorData) => {
        const fileId = editorData.editorId;

        const allRules = [];

        for (const [providerID, cb] of providers) {
            const data = getAceTriggeredData({
                data: editorData,
                mainSender: editorData.mainSender
            });

            delete data["api"]

            const result = cb(data);

            if (!Array.isArray(result)) continue;

            for (const item of result) {
                if (!item || typeof item !== "object") continue;

                if (
                    typeof item.id !== "string" ||
                    typeof item.regex !== "string" ||
                    typeof item.token !== "string"
                ) continue;

                allRules.push({
                    id: `${providerID}_${item.id}`,
                    regex: item.regex,
                    token: item.token
                });
            }
        }

        applyRules({ editorData: editorData, fileId: fileId, rules: allRules, mainSender: mainSender });
    });
}

function applyRules({ editorData, fileId, rules, mainSender }) {
    mainSender.send("on-editor-change-new-hl-rules", {
        fileId: fileId,
        rules: rules
    });
}

module.exports = { callback };