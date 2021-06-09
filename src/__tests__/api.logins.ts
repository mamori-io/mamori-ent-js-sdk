import { DMService, LoginResponse } from '../api';

import * as https from 'https';

const host = process.env.MAMORI_SERVER || '127.0.0.1';
const username = process.env.MAMORI_USERNAME || 'root';
const password = process.env.MAMORI_USERNAME || 'test';

const INSECURE = new https.Agent({rejectUnauthorized: false});

describe("server based tests", () => {

    test('login should succeed', async done => {
        try {
            let api = new DMService("https://" + host + "/", INSECURE);

            let response = await api.login(username, password);
            expect(response.username).toBe(username);

            await api.logout();
            done();
        } catch (e) {
            done(e);
        }
    });

});
