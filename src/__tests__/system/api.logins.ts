
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
});
