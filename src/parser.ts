export interface JavaMethod {
    name: string;
    signature: string;
    body: string;
    isPublic: boolean;
    calls?: string[];
}

export function parseJavaMethods(sourceCode: string): JavaMethod[] {
    const methods: JavaMethod[] = [];
    const controlKeywords = new Set(['if', 'for', 'while', 'switch', 'catch']);

    // Regex per Architecture specification:
    const methodRegex = /((?:(?:public|private|protected|static|final|abstract|synchronized|native|strictfp)\s+)*[\w<>\[\]]+\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*(?:throws\s+[a-zA-Z_$0-9,\s]+)?)\s*\{/g;

    let match: RegExpExecArray | null;
    while ((match = methodRegex.exec(sourceCode)) !== null) {
        const fullSig = match[1].trim();
        const methodName = match[2];

        if (controlKeywords.has(methodName)) {
            continue;
        }

        // Body extraction: count braces starting from the opening brace
        const openBraceIndex = sourceCode.indexOf('{', match.index + match[1].length);
        if (openBraceIndex === -1) {
            continue;
        }

        let braceDepth = 0;
        let endIndex = -1;
        let inString = false;
        let inChar = false;
        let inLineComment = false;
        let inBlockComment = false;

        for (let i = openBraceIndex; i < sourceCode.length; i++) {
            const char = sourceCode[i];
            const nextChar = i + 1 < sourceCode.length ? sourceCode[i + 1] : '';

            if (inLineComment) {
                if (char === '\n') {
                    inLineComment = false;
                }
                continue;
            }
            if (inBlockComment) {
                if (char === '*' && nextChar === '/') {
                    inBlockComment = false;
                    i++;
                }
                continue;
            }
            if (inString) {
                if (char === '\\') {
                    i++;
                } else if (char === '"') {
                    inString = false;
                }
                continue;
            }
            if (inChar) {
                if (char === '\\') {
                    i++;
                } else if (char === "'") {
                    inChar = false;
                }
                continue;
            }

            if (char === '/' && nextChar === '/') {
                inLineComment = true;
                i++;
                continue;
            }
            if (char === '/' && nextChar === '*') {
                inBlockComment = true;
                i++;
                continue;
            }
            if (char === '"') {
                inString = true;
                continue;
            }
            if (char === "'") {
                inChar = true;
                continue;
            }

            if (char === '{') {
                braceDepth++;
            } else if (char === '}') {
                braceDepth--;
                if (braceDepth === 0) {
                    endIndex = i;
                    break;
                }
            }
        }

        if (endIndex === -1) {
            continue;
        }

        const body = sourceCode.slice(openBraceIndex, endIndex + 1);

        // Call detection per spec: /(?<!\.)\b([a-z][a-zA-Z0-9_$]*)\s*\(/g
        const callRegex = /(?<!\.)\b([a-z][a-zA-Z0-9_$]*)\s*\(/g;
        const calls = new Set<string>();
        let callMatch: RegExpExecArray | null;
        while ((callMatch = callRegex.exec(body)) !== null) {
            const calledName = callMatch[1];
            if (!controlKeywords.has(calledName)) {
                calls.add(calledName);
            }
        }

        const isPublic = /\bpublic\b/.test(fullSig);

        methods.push({
            name: methodName,
            signature: fullSig,
            body,
            isPublic,
            calls: Array.from(calls)
        });

        methodRegex.lastIndex = endIndex + 1;
    }

    return methods;
}
