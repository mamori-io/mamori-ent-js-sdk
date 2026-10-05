/**
 * Leak / health soak helpers for Server Health Alert and resource attribution.
 * Full load soaks belong with live Hub; this verifies the setting API path.
 */
import { MamoriService } from '../../api';
import * as https from 'https';

const host = process.env.MAMORI_SERVER || '';
const username = process.env.MAMORI_USERNAME || '';
const password = process.env.MAMORI_PASSWORD || '';
const INSECURE = new https.Agent({ rejectUnauthorized: false });

const live = host && username ? test : test.skip;

describe('Server health alert + leak soak hooks', () => {
    let api: MamoriService;
    let previous: string | undefined;

    beforeAll(async () => {
        if (!host) return;
        api = new MamoriService(host, INSECURE);
        await api.login(username, password);
        const props = await api.get_system_properties('');
        previous = props.on_server_health_alert;
    });

    afterAll(async () => {
        if (!api) return;
        try {
            if (previous !== undefined) {
                await api.set_system_properties({ on_server_health_alert: previous || '' });
            }
        } finally {
            await api.logout();
        }
    });

    live('can set and read on_server_health_alert', async () => {
        const name = 'default_error_handler';
        await api.set_system_properties({ on_server_health_alert: name });
        const props = await api.get_system_properties('');
        expect(props.on_server_health_alert).toBe(name);
    });

    live('login session completes (user activity smoke)', async () => {
        // Exercises mamori_auth / api paths; gauges checked manually via fqod_metrics.log on Hub.
        // Hub (Derby) does not accept bare "select current_user" — needs VALUES or a FROM clause.
        const me = await api.select('values current_user');
        expect(me).toBeTruthy();
        expect(Array.isArray(me) ? me[0] : me).toBeTruthy();
    });
});
