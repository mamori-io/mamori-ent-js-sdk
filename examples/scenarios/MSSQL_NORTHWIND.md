# Test scenario for masking and revealing MSQL Northwind data.

Sample script for configuring a NORTHWIND db mask and reveal test scenario using the sdk.

In this scenario, the northwind db is configured as a datasource in the system and some tables and columns in the northwind db are masked by default. 
Users are granted access to the db via a specific nw role, which contains a credential to access the db. 
However, by default some of the data will be masked on select.

Users can unmask/reveal the data by requesting access using a mamori access policy. Access can be requested either via the
web portal or using the mamori mobile app. 

Once the user has requested access (and that access has been endorsed or auto approved) they will be able to see the data 
for a limited amount of time. The time is configured by the access policy. Once the time has elapsed the data wil revert to
being masked.

## Prerequsites
1. A northwind db and set of credentials

## Run scenario

Replace the URL, user and password with your mamori URL and mamori user credentials.

1. Create an admin user
```sh
yarn ts-node --transpile-only examples/configure/create_admin.ts --url <url> <user> <password> <admin user> <admin password>
```
2. Create the northwind datasource and grant the admin user a credential to access
```sh
 yarn ts-node --transpile-only examples/configure/create_mssql_ds.ts --url <url> <admin user> <admin password> <ds name> <ds host> <ds user> <ds pwd> <default db>
```
Hereafter use the admin user to login via the sdk.


3. Create a northwind user role
```sh
 yarn ts-node --transpile-only examples/configure/create_role.ts --url <url> <admin user> <admin password> <role name>  <-- e.g northwind_user
```
4. Grant the northwind user role a credential to access the northwind db.
```sh
 yarn ts-node --transpile-only examples/configure/grant_credential.ts --url <url> <admin user> <admin password> <role> <ds name> <ds host> <db user> <db pwd>
```
5. Create a northwind test user and grant then rights to work with mamori policies
```sh
 yarn ts-node --transpile-only examples/configure/create_user.ts --url <url> <admin user> <admin password> <user> <password>
```
6. Grant the northwind test user the northwind user role to give them access to the db
```sh
 yarn ts-node --transpile-only examples/configure/grant_role.ts --url <url> <admin user> <admin password> <grantee> <role to grant> <-- e.g northwind_user
```
7. Create a default policy to mask or hide columns in the NORTHWIND db.
```sh
 yarn ts-node --transpile-only examples/configure/create_defaukt_policy.ts --url <url> <admin user> <admin password> <ds> <db> <schema> <table> <column> [masking rule]
```
e.g 
```sh
 yarn ts-node --transpile-only examples/configure/create_defaukt_policy.ts --url <url> <admin user> <admin password> <ds> Northwind dbo Customers Address
```
If a masking rule is not provided it defaults to MASKED BY full().
 
To hide a column use:
```sh
 yarn ts-node --transpile-only examples/configure/create_defaukt_policy.ts --url <url> <admin user> <admin password> <ds> <db> <schema> <table> <column> HIDDEN
```
e.g
```sh
 yarn ts-node --transpile-only examples/configure/create_defaukt_policy.ts --url <url> <admin user> <admin password> <ds> Northwind dbo Customers Phone HIDDEN
```
8. Create a reveal role  to see the see the masked/hidden nw data.
```sh
 yarn ts-node --transpile-only examples/configure/create_role.ts --url <url> <admin user> <admin password> <role name> <-- e.g nw_access
```
9. Grant REVEAL to the reveal role 
```sh
 yarn ts-node --transpile-only examples/configure/grant_reveal.ts --url <url> <admin user> <admin password> <ds> <db> <schema> <table> <column> <reveal role> <-- e.g nw_access
```
Users with this role will be able to see masked nothwind data in the clear.

10. Create an ACCESS policy for requesting access to  masked/hidden NORTHWIND data.
The access policy grants the reveal role to the user for a limited number of minutes. This will give the user the ability to see the masked data
in the clear for a limited time.
```sh
 yarn ts-node --transpile-only examples/configure/create_access_policy.ts --url <url> <admin user> <admin password> <policy name> <request role> <endorse role> <minutes>
```
Set the request role to "nw_user" to allow users with the nw_user role to request access via this policy.
Set the endorse role to "nw_user" to allow users with the nw_user role to endorse requests for access using this policy.
If  the request role is the same as the endorse role then the request will automatically be approved for the requesting user. 

To enforce that the request is endorsed by a different (authorised) user use a different endorse role and assign that role to
your authorised users. In this scenario, access is requested by one user but must be endorsed (approved) by a different user.

Users can now access the northwind db by being granted the northwind_user role and then view masked data by requesting access using the access policy.

Copyright (c) 2021 mamori.io
