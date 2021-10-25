# One-task scripts for Mamori enterprise server and proxies

## Usage
Basic arguments for all scripts:
```sh
   yarn ts-node --transpile-only <script file> [--help] [--url url] user password
```
where:
- `user` is the mamori server user
- `password` is the user password   
- `url` is the application URL. Default: localhost:443

Use `--help` to see each scripts arguments.

|File | Description |
| :--- | :--- |
| `access_action.ts` | CANCEL, DENY, ENDORSE or EXECUTE and access request |
| `access_request.ts` | Make a policy access request |
| `create_access_policy.ts` | Create an access policy |
| `create_admin.ts` | Create a mamori user with the mamori_admin role |
| `create_default_policy.ts` | Create a default masking policy |
| `create_ipsec.ts` | Create an IPSEC network |
| `create_mssql_ds.ts` | Create an MSSQL datasouce |
| `create_named_policy.ts` | Create a named masking policy|
| `create_role.ts` | Create a mamori role |
| `create_rsa_pair.ts` | Create an RSA public-private key pair |
| `create_ssh_login.ts` | Create an SSH Login |
| `create_user.ts` | Create a mamori user |
| `grant.ts` | Grant any grantable to a user or role |
| `grant_credential.ts` | Add datasource credentials to a user or role |
| `grant_reveal.ts` | Grant REVEAL on all columns of a table to a user or role |
| `grant_role.ts` | Grant a role to a user or role |

----
Copyright (c) 2021 mamori.io
