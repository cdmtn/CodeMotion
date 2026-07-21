import { describe, it, expect } from "vitest"

function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;

    for (const key of Object.keys(source)) {
        const srcVal = source[key];
        const tgtVal = target[key];

        if (
            srcVal &&
            typeof srcVal === "object" &&
            !Array.isArray(srcVal) &&
            tgtVal &&
            typeof tgtVal === "object" &&
            !Array.isArray(tgtVal)
        ) {
            target[key] = deepMerge({ ...tgtVal }, srcVal);
        } else {
            target[key] = srcVal;
        }
    }

    return target;
}

describe("deepMerge", () => {
    it("merges flat objects", () => {
        const target = { a: 1 }
        const source = { b: 2 }
        expect(deepMerge(target, source)).toEqual({ a: 1, b: 2 })
    })

    it("overwrites existing keys", () => {
        const target = { a: 1 }
        const source = { a: 2 }
        expect(deepMerge(target, source)).toEqual({ a: 2 })
    })

    it("recursively merges nested objects", () => {
        const target = { a: { x: 1, y: 2 } }
        const source = { a: { y: 3, z: 4 } }
        expect(deepMerge(target, source)).toEqual({ a: { x: 1, y: 3, z: 4 } })
    })

    it("does not merge arrays", () => {
        const target = { a: [1, 2] }
        const source = { a: [3, 4] }
        expect(deepMerge(target, source)).toEqual({ a: [3, 4] })
    })

    it("returns target when source is null or undefined", () => {
        const target = { a: 1 }
        expect(deepMerge(target, null)).toEqual({ a: 1 })
        expect(deepMerge(target, undefined)).toEqual({ a: 1 })
    })

    it("returns target when source is not an object", () => {
        const target = { a: 1 }
        expect(deepMerge(target, "string")).toEqual({ a: 1 })
        expect(deepMerge(target, 42)).toEqual({ a: 1 })
    })

    it("merges deeply nested structures", () => {
        const target = { a: { b: { c: 1, d: 2 } } }
        const source = { a: { b: { d: 3, e: 4 } } }
        expect(deepMerge(target, source)).toEqual({ a: { b: { c: 1, d: 3, e: 4 } } })
    })

    it("handles empty objects", () => {
        expect(deepMerge({}, {})).toEqual({})
        expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 })
        expect(deepMerge({}, { a: 1 })).toEqual({ a: 1 })
    })
})
