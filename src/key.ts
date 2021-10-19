import { DMService } from './api';

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
        let result = new Key(ds.name) ;
        result.ofType(ds.type)
              .withKey(ds.key)
              .withPassword(ds.password)
              .ofSize(ds.size) ;

        return result ;
    }

    public static get_all(api: DMService) {
        return api.get_encryption_keys();
    }
    
    name: string ;
    type?: string ;
    key?: string ;
    password?: string;
    size: number = 1024 ;

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
    public async create(api: DMService) {
        if (this.type == 'RSA' && this.key == null) {
            return api.create_rsa_pair({
                name: this.name,
                size: this.size
            });
        }
        else {
            return api.create_encryption_key({
                name: this.name,
                type: this.type,
                password: this.password,
                value: this.key
            });
        }
    }

    public async delete(api: DMService) {
        return api.drop_encryption_key(this.name) ;
    }

    public async rename(api: DMService, name: string) {
        return api.update_encryption_key(this.name, {name: name});
    }

    /**
     * Update the key value, but not the password.
     * @param api 
     * @returns 
     */
    public async update(api: DMService) {
        return api.update_encryption_key(this.name, this.key);
    }

    public async grantTo(api: DMService, grantee: string) {
        return api.grant_encryption_keys_to(grantee, [this.name]);
    }

    public async revokeFrom(api: DMService, grantee: string) {
        return api.revoke_encryption_keys_from(grantee, [this.name]);
    }

    /**
     * @param type   Required Key type, e.g. AES, RSA, SSH
     * @returns 
     */
    public ofType(type: string) : Key {
        this.type = type;
        return this ;
    }

    /**
     * @param key  The key text, e.g. '-----BEGIN RSA PRIVATE KEY----- ...-----BEGIN RSA PRIVATE KEY------'
     * @returns 
     */
     public withKey(key: string) : Key {
        this.key = key ;
        return this ;
    }

    /**
     * @param password   Optional password for the key
     * @returns 
     */
    public withPassword(password: string) : Key {
        this.password = password ;
        return this ;
    }

    /**
     * @param size   Optional RSA key size on creation. Default: 1024
     * @returns 
     */
     public ofSize(size: number) : Key {
        this.size = size;
        return this ;
   }
}
