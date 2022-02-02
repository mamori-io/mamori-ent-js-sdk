/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */

export function sqlEscape(s: string): string {
    return s.replace(/'/g, "''");
}

export function handleAPIException(e: any): any {
    let payload = {
        baseURL: e.config.baseURL, url: e.config.url
        , method: e.config.method, data: e.config.data
        , response: { status: e.response.status, statusText: e.response.statusText, data: e.response.data }
    }
    return payload;
}

export function noThrow(call: Promise<any>): any {
    return call.catch(e => {
        let x = handleAPIException(e);
        console.log(x);
        return x;
    });
}

export function ignoreError(call: Promise<any>): any {
    return call.catch(e => {
        return handleAPIException(e);
    });
}

