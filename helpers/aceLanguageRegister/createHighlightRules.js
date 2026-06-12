export function createHighlightRules(config = {}) {
    const rules = []

    const safeArray = (arr) =>
        Array.isArray(arr) ? arr.filter(v => typeof v === "string" && v.trim()) : []

    const keywords = safeArray(config.keywords)
    const operators = safeArray(config.operators)
    const others = safeArray(config.other)
    const constants = safeArray(config.constants)
    const booleans = safeArray(config.booleans)
    const alreadyDefinedClassnames = safeArray(config.alreadyDefinedClassnames)
    const types = safeArray(config.types)
    const defineClassKeyword = config.defineClassKeyword
    const isUppercaseConstant = config.isUppercaseConstant

    const keywordMap = Object.create(null)
    keywords.forEach(k => keywordMap[k] = "keyword")

    const operatorsMap = Object.create(null)
    operators.forEach(k => operatorsMap[k] = "operator")

    const othersMap = Object.create(null)
    others.forEach(k => othersMap[k] = "other")

    const booleansMap = Object.create(null)
    booleans.forEach(b => booleansMap[b] = "constant.language.boolean")

    const constantsMap = Object.create(null)
    constants.forEach(k => constantsMap[k] = "constant.language")

    const typesMap = Object.create(null)
    types.forEach(t => typesMap[t] = "entity.name.class")

    const classNamesMap = Object.create(null)
    alreadyDefinedClassnames.forEach(c => classNamesMap[c] = "entity.name.type.class")

    if (config.comment) {
        rules.push({
            token: "comment",
            regex: config.comment
        })
    }

    if (config.string) {
        rules.push({
            token: "string",
            regex: config.string
        })
    }

    if (config.numbers) {
        rules.push({
            token: "constant.numeric",
            regex: config.numbers
        })
    }

    if (config.variable) {
        rules.push({
            token: "variable",
            regex: config.variable
        })
    }

    if (config.custom) {
        config.custom.forEach(e => {
            if (e.regex && e.type) {
                rules.push({
                    token: e.type,
                    regex: e.regex
                })
            }
        })
    }

    if (defineClassKeyword) {
        rules.push({
            token: ["keyword", "text", "entity.name.type.class"],
            regex: `(${defineClassKeyword})(\\s+)([a-zA-Z_$][a-zA-Z0-9_$]*)`
        })
    }

    if (config.defineFunctionKeyword && config.functions) {
        rules.push({
            token: ["keyword", "text", "entity.name.type.function"],
            regex: `(${config.defineFunctionKeyword})(\\s+)([a-zA-Z_$][a-zA-Z0-9_$]*)`
        })
    }

    if (config.functionCalls) {
        rules.push({
            token: "support.function",
            regex: config.functionCalls
        })
    }

    if (config.variables) {
        rules.push({
            token: "variable",
            regex: config.variables
        })
    }

    if (config.className || config.camelCaseAsClassname) {
        rules.push({
            token: "entity.name.type.class",
            regex: "\\b[A-Z][a-zA-Z0-9]+\\b"
        })
    }

    // if (config.uppercaseAsConstant) {
    //     rules.push({
    //         token: "constant.language",
    //         regex: "(?<![A-Za-z0-9_])_*[A-Z][A-Z0-9_]*(?![A-Za-z0-9_])"
    //     })
    // }

    rules.push({
        token: function (value) {
            if (isUppercaseConstant && /^[A-Z]+$/.test(value)) return "constant.language"
            if (typesMap[value]) return "entity.name.class"
            if (booleansMap[value]) return "constant.language.boolean"
            if (keywordMap[value]) return "keyword"
            if (operatorsMap[value]) return "operator"
            if (othersMap[value]) return "other"
            if (constantsMap[value]) return "constant.language"
            if (classNamesMap[value]) return "entity.name.type.class"

            return "text"
        },
        regex: "\\b[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
    })

    return { start: rules }
}