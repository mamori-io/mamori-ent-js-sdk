
import { MamoriService, LoginResponse } from '../../api';
import * as https from 'https';

const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';

const INSECURE = new https.Agent({ rejectUnauthorized: false });

describe("server based tests", () => {

    test('login should succeed', async () => {
        console.log("%s %s", host, username);
        let api = new MamoriService(host, INSECURE);
        let response = await api.login(username, password);
        expect(response.username).toBe(username);

        await api.logout();
    });

    if(process.env.AD_USER) {
        test('ch6473 - validation failures',async () => {
            let api = new MamoriService(host, INSECURE);
            try {
                await api.login(username, password);

                let sql = "VALIDATE AUTHENTICATION USERNAME '" + process.env.AD_USER + "' PASSWORD '" + process.env.AD_USER_PASSWORD + "' WITH PROVIDER '" + process.env.AD_AUTH_PROVIDER + "'";
                for(let i=0; i<100; i++) {
                    await api.select(sql);
                }

                await expect(async() => {
                    await api.select("VALIDATE AUTHENTICATION USERNAME 'hfdhjdfjhdfgjhdfj' PASSWORD 'hnjdfjhfdghj' WITH PROVIDER '" + process.env.AD_AUTH_PROVIDER + "'");
                }).rejects.toThrow();
            } finally {
                await api.logout();                
            }
        })
    }
});
