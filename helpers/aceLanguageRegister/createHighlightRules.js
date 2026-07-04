const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const normalizeStateRule = (r) => {
    if (r.include) return { include: r.include }
    if (r.defaultToken) return { defaultToken: r.defaultToken }
    const rule = { regex: r.regex, token: r.token }
    if (r.push) rule.push = r.push
    if (r.next) rule.next = r.next
    return rule
}

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

    if (config.characters) {
        rules.push({
            token: "character",
            regex: config.characters
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
                const rule = { token: e.type, regex: e.regex }
                if (e.push) rule.push = e.push
                if (e.next) rule.next = e.next
                rules.push(rule)
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

    const result = { start: rules }

    if (config.states) {
        Object.entries(config.states).forEach(([stateName, stateDef]) => {
            if (Array.isArray(stateDef)) {
                result[stateName] = stateDef.map(normalizeStateRule)
                return
            }

            if (stateDef && stateDef.rules) {
                result[stateName] = stateDef.rules.map(normalizeStateRule)

                if (stateDef.enter && stateDef.enter.regex) {
                    rules.push({
                        token: stateDef.enter.token || stateName,
                        regex: stateDef.enter.regex,
                        push: stateName
                    })
                }
            }
        })
    }

    if (config.templateLiteral) {
        const {
            delimiter = "`",
            interpStart = "${",
            interpEnd = "}",
            escape = "\\\\."
        } = config.templateLiteral

        rules.push({
            token: "string",
            regex: escapeRegex(delimiter),
            push: "tstring"
        })

        result.tstring = [
            { token: "constant.character.escape", regex: escape },
            { token: "paren.lparen.interpolation", regex: escapeRegex(interpStart), push: "interpolation" },
            { token: "string", regex: escapeRegex(delimiter), next: "pop" },
            { defaultToken: "string" }
        ]

        result.interpolation = [
            { token: "paren.rparen.interpolation", regex: escapeRegex(interpEnd), next: "pop" },
            { include: "start" }
        ]
    }

    if (config.highlightFunctionArguments) {
        const typesList = types.length ? types.join("|") : null
        const entries = []

        if (config.highlightFunctionArguments === true) {
            if (config.defineFunctionKeyword) {
                entries.push({
                    token: ["keyword", "text", "entity.name.type.function", "text", "paren.lparen.func"],
                    regex: `(${config.defineFunctionKeyword})(\\s+)([a-zA-Z_$][a-zA-Z0-9_$]*)(\\s*)(\\()`
                })
            }
        } else if (Array.isArray(config.highlightFunctionArguments)) {
            entries.push(...config.highlightFunctionArguments)
        } else if (typeof config.highlightFunctionArguments === "string") {
            entries.push({ token: "paren.lparen.func", regex: config.highlightFunctionArguments })
        }

        entries.slice().reverse().forEach(e => {
            rules.unshift({ token: e.token, regex: e.regex, push: "funcSignature" })
        })

        result.funcSignature = [
            { token: "text", regex: ":\\s*(?=[A-Za-z_])", push: "typeExpr" },
            { token: "text", regex: "," },
            { token: "paren.rparen.func", regex: "\\)" },
            { regex: "(?=\\{|=>)", next: "pop" },
            { defaultToken: "text" }
        ]

        result.typeExpr = [
            ...(typesList ? [{ token: "entity.name.class", regex: `\\b(${typesList})\\b` }] : []),
            { token: "keyword.operator", regex: "\\|(?!\\|)" },
            { token: "keyword.operator", regex: "\\[\\]" },
            { token: "paren.lparen.generic", regex: "<", push: "typeExpr" },
            { token: "paren.rparen.generic", regex: ">", next: "pop" },
            { token: "entity.name.type.class", regex: "[a-zA-Z_$][a-zA-Z0-9_$]*" },
            { regex: "\\s+" },
            { regex: "(?=[,;=\\)\\{]|=>)", next: "pop" }
        ]
    }

    return result
}