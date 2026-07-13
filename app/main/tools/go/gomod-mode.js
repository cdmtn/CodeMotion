ace.define("ace/mode/gomod_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function(require, exports, module) {
    const oop = require("ace/lib/oop");
    const TextHighlightRules = require("ace/mode/text_highlight_rules").TextHighlightRules;

    const GoModHighlightRules = function() {
        this.$rules = {
            start: [
                {
                    token: "comment.line",
                    regex: /\/\/.*$/,
                },
                {
                    token: "keyword.control",
                    regex: /^(?:module|go|require|replace|exclude|retract)\b/,
                    next: "directive",
                },
                {
                    token: "paren.lparen",
                    regex: /\(/,
                    next: "block",
                },
            ],

            directive: [
                {
                    token: "constant.numeric",
                    regex: /\b\d+\.\d+(?:\.\d+)?\b/,
                },
                {
                    token: "string.unquoted",
                    regex: /[a-zA-Z0-9][\w\-]*(?:\.[a-zA-Z][\w\-]*)+(?:\/[\w\.\-~]+)*/,
                },
                {
                    token: "keyword.operator",
                    regex: /=>/,
                },
                {
                    token: "string.other",
                    regex: /\.\.?\/[\w\/\.\-]*/,
                },
                {
                    token: "constant.language",
                    regex: /v\d+\.\d+\.\d+(?:-[\w\.\+]+)?(?:\+incompatible)?/,
                },
                {
                    token: "text",
                    regex: /$/,
                    next: "start",
                },
            ],

            block: [
                {
                    token: "comment.line",
                    regex: /\/\/.*$/,
                },
                {
                    token: "paren.rparen",
                    regex: /\)/,
                    next: "start",
                },
                {
                    token: "string.unquoted",
                    regex: /[a-zA-Z0-9][\w\-]*(?:\.[a-zA-Z][\w\-]*)+(?:\/[\w\.\-~]+)*/,
                },
                {
                    token: "keyword.operator",
                    regex: /=>/,
                },
                {
                    token: "string.other",
                    regex: /\.\.?\/[\w\/\.\-]*/,
                },
                {
                    token: "constant.language",
                    regex: /v\d+\.\d+\.\d+(?:-[\w\.\+]+)?(?:\+incompatible)?/,
                },
                {
                    token: "comment.line.indirect",
                    regex: /\/\/\s*indirect\b/,
                },
            ],
        };

        this.normalizeRules();
    };

    oop.inherits(GoModHighlightRules, TextHighlightRules);
    exports.GoModHighlightRules = GoModHighlightRules;
});

ace.define("ace/mode/gomod", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/gomod_highlight_rules"], function(require, exports, module) {
    const oop = require("ace/lib/oop");
    const TextMode = require("ace/mode/text").Mode;
    const GoModHighlightRules = require("ace/mode/gomod_highlight_rules").GoModHighlightRules;

    const Mode = function() {
        this.HighlightRules = GoModHighlightRules;
        this.$behaviour = this.$defaultBehaviour;
    };

    oop.inherits(Mode, TextMode);

    (function() {
        this.lineCommentStart = "//";
        this.$id = "ace/mode/gomod";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});