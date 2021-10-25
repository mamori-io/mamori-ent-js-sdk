/*
 * Copyright (c) 2021 mamori.io.  All Rights Reserved.
 *
 * This software contains the confidential and proprietary information of mamori.io.
 * Parties accessing this software are required to maintain the confidentiality of all such information.
 * mamori.io reserves all rights to this software and no rights and/or licenses are granted to any party
 * unless a separate, written license is agreed to and signed by mamori.io.
 */
import { DMService } from './api';

export class Network {

    public static getAll(api: DMService) : Promise<any> {
        return api.callAPI("GET", "/v1/vpns");
    }

    name: string ;
    type: string ;

   /**
    * @param name  Unique network name
    */
    public constructor(name: string, type: string) {
        this.name = name.toLowerCase();
        this.type = type;
    }

    public create(api: DMService) : Promise<any> {
        return api.callAPI("POST", "/v1/vpns", {
            vpn: {
                name: this.name, 
                type: this.type, 
                config: this.getConfig(),
                secrets: this.getSecrets()
            }
       }) ;
    }
     
    public delete(api: DMService) : Promise<any> {
        return api.callAPI("DELETE", "/v1/vpns/" + this.name) ;
    }

    public start(api: DMService) : Promise<any> {
        return api.callAPI("PUT", "/v1/vpns/" + this.name + "/start");
    }

    public status(api: DMService) : Promise<any> {
        return api.callAPI("GET", "/v1/vpns/" + this.name + "/status");
    }

    public stop(api: DMService) : Promise<any> {
        return api.callAPI("PUT", "/v1/vpns/" + this.name + "/stop");
    }

    public getConnectionLog(api: DMService) : Promise<any> {
        return api.callAPI("GET", "/v1/vpns/" + this.name + "/logs");
    }

    getConfig() {
        throw new Error('Method not implemented.');
    }
    
    getSecrets() {
        throw new Error('Method not implemented.');
    }
}

/**
 * A IpSecVpn is a network connection over an IPSEC VPN.
 * For an example, see `examples/configure/create_ipsec.ts`.
 */
 export class IpSecVpn extends Network {

    /**
     * @param vpn 
     * @returns 
     */
    public static build(vpn: any): IpSecVpn {
        let result = new IpSecVpn(vpn.name) ;
        result.host = vpn.host ;
        result.password = vpn.password ;
        result.psk = vpn.psk ;
 
        return result ;
    }
 
    host?: string ;
    user?: string ;
    password?: string ; 
    psk?: string ;
 
    /**
     * @param name  Unique network name
     */
    public constructor(name: string) {
        super(name, 'ipsec');
    }
 
    getConfig() {
        return  {
            username: this.user, 
            host: this.host, 
        } ;
    }

    getSecrets() {
        return  [{
            name: 'password',
            value: this.password
        },
        {
            name: 'psk',
            value: this.psk
        }] ;
    }

    /**
      * Set the address of the target resource
      * @param host  Required host name or IP address of the target resource
      * @returns 
      */
      public at(host: string) : IpSecVpn {
         this.host = host;
         return this ;
     }
 
     /**
      * Set the creadentials to use when connecting to the target resource
      * @param user      Required user name
      * @param password  Required password
      * @returns 
      */
      public withCredentials(user: string, password: string) : IpSecVpn {
         this.user = user;
         this.password = password;
         return this ;
     }

     /**
      * @param psk  Required pre-shared key
      * @returns 
      */
      public withPreSharedKey(psk: string) : IpSecVpn {
        this.psk = psk;
        return this ;
    }
}

 export class OpenVPN extends Network {

    /**
     * @param vpn 
     * @returns 
     */
    public static build(vpn: any): OpenVPN {
        let result = new OpenVPN(vpn.name) ;
        result.host = vpn.host ;
        result.port = vpn.port ;
        result.user = vpn.user ;
        result.password = vpn.password ;

        if (vpn.transport) {
            result.transport = vpn.transport ;
        }
        if (vpn.network) {
            result.network = vpn.network ;
        }
        result.keyDirection = vpn.keyDirection ;
        if (vpn.compression) {
            result.compression = vpn.compression ;
        }
        result.tlsClient = vpn.tls_client ;

        result.caCert = vpn.ca_crt ;
        result.taCert = vpn.ta_crt ;
        result.clientCert = vpn.client_crt ;
        result.clientKey = vpn.client_key ;
 
        return result ;
    }

    host?: string ;
    port?: number ;
    user?: string ;
    password?: string ;

    transport: string = "udp";
    network: string = "tun" ;
    keyDirection?: string ;
    compression?: string = "yes" ;
    tlsClient: boolean = false ;

    caCert?: string ;
    taCert?: string ;
    clientCert?: string ;
    clientKey?: string ;

    /**
     * @param name  Unique network name
     */
    public constructor(name: string) {
        super(name, 'openvpn');
    }

    getConfig() {
        return  {
            host: this.host,
            port: this.port,
            transport: this.transport,
            network: this.network,
            compression: this.compression,
            tls_client: this.tlsClient,
            key_direction: this.keyDirection
        }
    }

    getSecrets() {
        return  [{
            name: "vpn-user",
            value: this.user
        }, {
            name: "vpn-password",
            value: this.password
        }, {
            name: "vpn-ca",
            value: this.caCert
        }, {
            name: "vpn-ta",
            value: this.taCert
        }, {
            name: "vpn-client-cert",
            value: this.clientCert
        }, {
            name: "vpn-client-key",
            value: this.clientKey
        }] ;
    }

    /**
     * Set the address of the target resource
     * @param host  Required host name or IP address of the target resource
     * @param port  Required listening port of the target resource
     * @returns 
     */
     public at(host: string, port: any) : OpenVPN {
        this.host = host;
        this.port = port;
        return this ;
    }

    /**
     * Set the creadentials to use when connecting to the target resource
     * @param user      Required user name
     * @param password  Required password
     * @returns 
     */
     public withCredentials(user: string, password: string) : OpenVPN {
        this.user = user;
        this.password = password;
        return this ;
    }

    /**
     * Default: udp
     * @param transport  Either 'udp' or 'tcp'.
     * @returns 
     */
    public withTransport(transport: string) : OpenVPN {
        this.transport = transport ;
        return this ;
    }

    /**
     * Default: tun
     * @param network  Either 'tun' or 'tap'.
     * @returns 
     */
     public withNetwork(network: string) : OpenVPN {
        this.network = network ;
        return this ;
    }

    /**
     * Default: null
     * @param keyDirection  Values: null, 0, 1
     * @returns 
     */
     public withKeyDirection(keyDirection: string) : OpenVPN {
        this.keyDirection = keyDirection ;
        return this ;
    }

    /**
     * Default: null
     * @param compression  Values: null, "yes", "no"
     * @returns 
     */
     public withCompression(compression: string) : OpenVPN {
        this.compression = compression ;
        return this ;
    }

    public usingTlsClient() : OpenVPN {
        this.tlsClient = true ;
        return this ;
    }

    /**
     * 
     * @param caCert 
     * @returns 
     */
    public withCaCertificate(caCert: string) : OpenVPN {
        this.caCert = caCert ;
        return this ;
    }

    /**
     * 
     * @param taCert 
     * @returns 
     */
    public withTaCertificate(taCert: string) : OpenVPN {
        this.taCert = taCert ;
        return this ;
    }

    /**
     * 
     * @param clientCert 
     * @returns 
     */
    public withClientCertificate(clientCert: string) : OpenVPN {
        this.clientCert = clientCert ;
        return this ;
    }

    /**
     * 
     * @param clientKey 
     * @returns 
     */
    public withClientKey(clientKey: string) : OpenVPN {
        this.clientKey = clientKey ;
        return this ;
    }
}

 /**
  * A SshTunnel is a network connection via an ssh tunnel.
  * See example in `examples/api/create_vpn_ssh.ts`.
  */
 export class SshTunnel extends Network {

    /**
     * @param vpn 
     * @returns 
     */
    public static build(vpn: any): SshTunnel {
        let result = new SshTunnel(vpn.name) ;
        result.host = vpn.host ;
        result.port = vpn.port ;
        result.user = vpn.user ;
        result.privateKeyId = vpn.privateKeyId ;

        result.localPort  = vpn.localPort ;
        result.remoteHost = vpn.remoteHost ;
        result.remotePort = vpn.remotePort ;
 
        return result ;
    }
 
    host?: string ;
    port?: number ;
    user?: string ;
    privateKeyId?: string ;
 
    localPort?: number ;
    remoteHost?: string ;
    remotePort?: number ;
 
    /**
     * @param name  Unique network name
     */
    public constructor(name: string) {
        super(name, 'ssh');
    }
 
    getConfig() {
        return  {
            username: this.user, 

            host: this.host, 
            port: this.port, 
            
            localPort: this.localPort, 
            remoteHost: this.remoteHost,
            remotePort: this.remotePort
        } ;
    }

    getSecrets() {
        return  [{
            name: "privateKeyId", 
            value: this.privateKeyId
        }] ;
    }

    /**
      * Set the address of the target resource
      * @param host  Required host name or IP address of the SSH server
      * @param port  Required listening port of the SSH server
      * @returns 
      */
      public at(host: string, port: any) : SshTunnel {
         this.host = host;
         this.port = port;
         return this ;
     }
 
     /**
      * Set the credentials to use when connecting to the SSH server.
      * @param user          Required user name
      * @param privateKeyId  Required private key name (an existing SSH key).
      * @returns 
      */
      public withCredentials(user: string, privateKeyId: string) : SshTunnel {
         this.user = user;
         this.privateKeyId = privateKeyId;
         return this ;
     }

     /**
      * Specifies that connections to the TCP port on the local (client) host are to be forwarded to the remote host and port.
      * @param localPort 
      * @param remoteHost 
      * @param remotePort 
      * @returns 
      */
     public forward(localPort: number, remoteHost: string, remotePort: number) : SshTunnel {
        this.localPort = localPort;
        this.remoteHost = remoteHost;
        this.remotePort = remotePort;
        return this ;
    }
}