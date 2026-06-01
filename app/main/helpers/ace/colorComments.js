export class ColorComments {
    static install(editor) {
        const allowedModes = [
            "javascript", "typescript", "php"
        ]
        const modeName = editor.session.$modeId.split("/").pop();
        const session = editor.getSession();

        if(!(allowedModes.includes(modeName))) return

        const original = session.bgTokenizer.getTokens;

        session.bgTokenizer.getTokens = function (row) {
            const tokens = original.call(this, row);

            tokens.forEach(token => {
                if (token.type === "comment") {
                    if (token.value.startsWith("// !")) {
                        token.type = "comment_danger";
                    }
                    else if (token.value.startsWith("// ?")) {
                        token.type = "comment_what";
                    }
                    else if (token.value.startsWith("// ...")) {
                        token.type = "comment_todo";
                    }
                }
            });

            return tokens;
        };

        session.bgTokenizer.start(0);
    }
}