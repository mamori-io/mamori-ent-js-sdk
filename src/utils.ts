/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */

export function hex2a(hex: any) {
    var str = '';
    for (var i = 0; i < hex.length; i += 2) str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
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

