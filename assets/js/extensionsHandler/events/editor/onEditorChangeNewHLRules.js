export function onEditorChangeNewHLRulesCallback({ data, contexts, refreshEditorHighlight }) {
    const { fileId, rules } = data;

    console.log(data)

    contexts[fileId] = new Map();

    for (const rule of rules) {
        contexts[fileId].set(rule.id, rule);
    }

    refreshEditorHighlight();
}