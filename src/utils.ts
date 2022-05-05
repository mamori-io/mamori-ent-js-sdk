/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */

export enum FILTER_OPERATION {
    EQUALS_STRING = "equals",
    CONTAINS = "contains",
    NOT_CONTAINS = "notcontains",
    STARTS_WITH = "startswith",
    ENDS_WITH = "endswith",
    IS_BLANK = "isblank",
    IS_NOT_BLANK = "isnotblank",
    GREATER_THAN = ">",
    LESS_THAN = "<",
    GREATER_THAN_OR_EQUAL = ">=",
    LESS_THAN_OR_EQUAL = "<=",
    EQUALS = "=",
    NOT_EQUAL = "<>"
}

export function prepareFilter(filter: any): any {
    let filters = filter;
    if (filter && filter.length > 0) {
        let ndx = 0;
        filters = {};
        filter.forEach((element: any) => {
            filters[ndx.toString()] = element;
            ndx++
        });
    }
    return filters;
}

export function hex2a(hex: any) {
    var str = '';
    for (var i = 0; i < hex.length; i += 2) str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}

export function base64_encode(v: any): any {
    if (v) {
        return Buffer.from(v, 'binary').toString('base64');
    }
    return v;
}

export function base64_decode(v: any): any {
    if (v) {
        return Buffer.from(v, 'base64').toString();
    }
    return v;
}

export function sqlEscape(s: string): string {
    return s.replace(/'/g, "''");
}

export function handleAPIException(e: any): any {
    let payload: any = {};
    if (e.message) {
        payload.errors = true;
        payload.message = e.message;
    }
    if (e.config) {
        payload.errors = true;
        payload.baseURL = e.config.baseURL;
        payload.url = e.config.url;
        payload.method = e.config.method;
        payload.data = e.config.data;
    }
    if (e.response) {
        payload.response = { status: e.response.status, statusText: e.response.statusText, data: e.response.data }
    }
    return payload;
}

export function noThrow(call: Promise<any>): any {
    try {
        return call.catch(e => {
            let x = handleAPIException(e);
            console.log(x);
            return x;
        });
    } catch (e) {
        let x = handleAPIException(e);
        console.log(x);
        return x;
    }
}

export function ignoreError(call: Promise<any>): any {
    try {
        return call.catch(e => {
            let x = handleAPIException(e);
            return x;
        });
    } catch (e) {
        let x = handleAPIException(e);
        return x;
    }
}

export function objectClone(target: any, source: any) {
    if (Array.isArray(source)) {
        throw new Error('source is an array. must be an object');
    }

    Object.keys(source).forEach(key => {
        const s_val = source[key];
        const t_val = target[key];
        if (Array.isArray(s_val)) {
            target[key] = [];
            s_val.forEach(e => {
                let o = (typeof e == 'object') ? objectClone({}, e) : e;
                target[key].push(o);
            });
        } else {
            target[key] = t_val && s_val && typeof t_val === 'object' && typeof s_val === 'object'
                ? objectClone(t_val, s_val)
                : s_val;
        }
    });
    return target
}

export interface Message {
    command: string;
    params: string[];
}

const LENGTH = 0;
const DATA = 1;
const SEP = 2;

export function decodeMessage(s: string): Message {
    let parts: string[] = [];

    let state = LENGTH;
    let fragmentLength = 0;
    const L = s.length;
    let idx = 0;
    let ch = null;

    while (idx < L) {
        switch (state) {
            case LENGTH:
                ch = s.charAt(idx);
                idx++;
                if (ch == ".") {
                    state = DATA;
                } else if (ch >= "0" && ch <= "9") {
                    fragmentLength = (fragmentLength * 10) + Number(ch);
                } else {
                    throw "Expected a number or a dot got '" + ch + "' at " + idx;
                }
                break;

            case DATA:
                if (idx + fragmentLength > L) {
                    throw "Unexpected end of data";
                }
                let part = s.substr(idx, fragmentLength);
                parts.push(part);
                idx = idx + fragmentLength;
                fragmentLength = 0;
                state = SEP;
                break;

            case SEP:
                ch = s.charAt(idx);
                idx++;
                if (ch == ",") {
                    state = LENGTH;
                } else if (ch == ";") {
                    if (idx < L) {
                        throw "Unexpected data after terminator";
                    }
                } else {
                    throw "Expected comma or semicolon got '" + ch + "' at " + idx;
                }
                break;
        }
    }
    let res: any = {};
    res.command = parts.shift();
    res.params = parts;
    return res;
}


