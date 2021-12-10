/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { MamoriService } from './api';

/**
 * A Key is a named cryptographic key.
 * 
 * Example use:
 * ```javascript
 * Key key = new Key('test_rasa').ofType('RSA') ;
 * await key.create(api);
 * ```
 * or
 * ```javascript
 * await Key.build({
 *     name: 'test_rasa',
 *     type: 'RSA'
 * }).create(api);
 * ```
 */
export class Key {

    /**
     * @param ds 
     * @returns 
     */
    public static build(ds: any): Key {
        let result = new Key(ds.name);
        result.ofType(ds.type)
            .withKey(ds.key)
            .withPassword(ds.password)
            .ofSize(ds.size);

        return result;
    }

    public static getAll(api: MamoriService): Promise<any> {
        return api.callAPI("GET", "/v1/encryption_keys");
    }

    name: string;
    type?: string;
    key?: string;
    password?: string;
    size: number = 1024;

    /**
     * @param name  Unique Key name
     */
    public constructor(name: string) {
        this.name = name;
    }

    /**
     * For AES, if the key value is null, a random key will be generated.
     * 
     * For RSA, if the key value is null, a key pair of the given size will be generated. 
     * The pair will be named '<this.name>_public' and '<this.name>_private'.
     * 
     * For SSH, the key may be the private or public key or both.
     * 
     * @param api 
     * @returns 
     */
    public create(api: MamoriService): Promise<any> {
        if (this.type == 'RSA' && this.key == null) {
            return api.callAPI("POST", "/v1/encryption_keys/create/rsapair", {
                name: this.name,
                size: this.size
            });
        }
        else {
            return api.callAPI("POST", "/v1/encryption_keys", {
                name: this.name,
                type: this.type,
                password: this.password,
                value: this.key
            });
        }
    }

    public delete(api: MamoriService): Promise<any> {
        return api.callAPI("DELETE", "/v1/encryption_keys/" + this.name);
    }

    public rename(api: MamoriService, name: string): Promise<any> {
        return api.callAPI("PUT", "/v1/encryption_keys/" + this.name, { name: name });
    }

    /**
     * Update the key value, but not the password.
     * @param api 
     * @returns 
     */
    public update(api: MamoriService): Promise<any> {
        return api.callAPI("PUT", "/v1/encryption_keys/" + this.name, this.key);
    }

    public grantTo(api: MamoriService, grantee: string): Promise<any> {
        return api.callAPI("POST", "/v1/grantee/" + encodeURIComponent(grantee.toLowerCase()) + "/encryption_keys", { encryption_keys: [this.name] });
    }

    public revokeFrom(api: MamoriService, grantee: string): Promise<any> {
        return api.callAPI("DELETE", "/v1/grantee/" + encodeURIComponent(grantee.toLowerCase()) + "/encryption_keys", { encryption_keys: [this.name] });
    }

    /**
     * @param type   Required Key type, e.g. AES, RSA, SSH
     * @returns 
     */
    public ofType(type: string): Key {
        this.type = type;
        return this;
    }

    /**
     * @param key  The key text, e.g. '-----BEGIN RSA PRIVATE KEY----- ...-----BEGIN RSA PRIVATE KEY------'
     * @returns 
     */
    public withKey(key: string): Key {
        this.key = key;
        return this;
    }

    /**
     * @param password   Optional password for the key
     * @returns 
     */
    public withPassword(password: string): Key {
        this.password = password;
        return this;
    }

    /**
     * @param size   Optional RSA key size on creation. Default: 1024
     * @returns 
     */
    public ofSize(size: number): Key {
        this.size = size;
        return this;
    }
}
