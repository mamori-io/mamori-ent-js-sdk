const SPACE   = /[ \r\n\t]/;
const ATOM    = /[^\(\)'"\r\n\t ]/;
const NUMBER  = /^-?\d+(?:\.\d+)?$/;

export interface SexpOptions {
    translateSymbol?: (sym: string) => string;
    translateString?: (str: string) => string;
    translateNumber?: (num: string) => number;
}

export function sexp(source: string, opts: SexpOptions = {}): any {    

    var tSymbol = opts.translateSymbol ?? function(sym: string) { return sym; },
        tString = opts.translateString ?? function(str: string) { return str; },
        tNumber = opts.translateNumber ?? parseFloat;

    var ix  = 0,
        len = source.length;

    function parseAtom() {
        var start = ix++;
        while (ATOM.test(source[ix]))
            ix++;
        var atom = source.substring(start, ix);
        if (NUMBER.test(atom)) {
            return tNumber(atom);
        } else {
            return tSymbol(atom);
        }
    }

    function parseString(quote: string) {
        var start = ix++;
        var ch;
        while (ix < len && (ch = source[ix]) !== quote) {
            ix++;
            if(ch === '\\') {
                ix++;
            }
        }
        if (ix === len)
            throw new Error("parse error - unterminated string");
        ix++;
        return tString(source.substring(start + 1, ix - 1));
    }

    function parseSexp(): any {

        while (SPACE.test(source[ix]))
            ix++;

        if (source[ix++] !== '(')
            throw new Error("parse error");

        var items   = [],
            state   = 'out',
            start   = null;

        while (ix < source.length) {
            var ch = source[ix];
            if (ch === ')') {
                ix++;
                return items;
            } else if (ch === '(') {
                items.push(parseSexp());
            } else if (ch === '"' || ch === '\'') {
                items.push(parseString(ch));
            } else if (SPACE.test(ch)) {
                ix++;
            } else {
                items.push(parseAtom());
            }
        }

        throw new Error("parse error");

    }

    return parseSexp();
}