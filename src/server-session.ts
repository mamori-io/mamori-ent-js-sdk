
import { MamoriService } from './api';
import { DB_PERMISSION } from './permission';

//const fs = require('fs');
export class ServerSession {
    public static setPassthrough(api: MamoriService, datasourceName: string): Promise<any> {
        //
        //Passing in the option with a connection name causes it to not apply passthrough mode
        //let connectionName = datasourceName + Date.now();
        let SQL = "set " + DB_PERMISSION.PASSTHROUGH + " '" + datasourceName + "' true";
        return api.select(SQL).then(result => {
            return { errors: false, result: result };
        }).catch(e => {
            let payload = { sql: SQL, status: e.response.status, error: e.response.data };
            //fs.writeFileSync('./error.json', JSON.stringify(payload));
            return { errors: true, payload };
        });
    }
} 