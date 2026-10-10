import assert from 'node:assert/strict';
import test from 'node:test';
import { devConnection, failureCategory } from './preflight-ocpi.ts';

const ref = 'heafsrqaytsfthfcxmqu';
const env = (url) => ({ GROW_EV_PROJECT_REF: ref, GROW_EV_DATABASE_URL: url, GROW_EV_DATABASE_CA_FILE: 'private-ca.crt' });

test('DEV preflight rejects other projects, transaction pooling and missing CA', () => {
  const valid = `postgresql://postgres.${ref}:example@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`;
  assert.equal(devConnection(env(valid)).port, '5432');
  assert.throws(() => devConnection(env(valid.replace(':5432', ':6543'))), /CONFIGURATION/);
  assert.throws(() => devConnection(env(valid.replace(ref, 'otherproject'))), /CONFIGURATION/);
  assert.throws(() => devConnection({ ...env(valid), GROW_EV_DATABASE_CA_FILE: undefined }), /CONFIGURATION/);
  assert.throws(() => devConnection(env(valid.replace('/postgres', '/otherdb'))), /CONFIGURATION/);
  assert.throws(() => devConnection(env(valid.replace('pooler.supabase.com', 'pooler.supabase.com.example.org'))), /CONFIGURATION/);
  assert.throws(() => devConnection(env('invalid')), /CONFIGURATION/);
  assert.throws(() => devConnection(env(`${valid}?ssl=false`)), /CONFIGURATION/);
  const direct = devConnection(env(`postgresql://postgres:example@db.${ref}.supabase.co/postgres?sslmode=disable&sslrootcert=bad`));
  assert.equal(direct.search, '');
});

test('preflight categorizes failures without exposing raw private error messages', () => {
  for (const [code, category] of [['28P01', 'AUTHENTICATION'], ['ENETUNREACH', 'NETWORK'],
    ['ERR_TLS_CERT_ALTNAME_INVALID', 'TLS_ERR_TLS_CERT_ALTNAME_INVALID'], ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'TLS_UNABLE_TO_VERIFY_LEAF_SIGNATURE'],
    ['42501', 'DATABASE_AUTHORIZATION'], ['53300', 'DATABASE_CONNECTION_LIMIT']]) {
    assert.equal(failureCategory({ code, message: 'private connection string' }), category);
  }
  assert.equal(failureCategory(new Error('UNFINISHED_POLL')), 'UNFINISHED_POLL');
  assert.equal(failureCategory(new Error('TLS')), 'TLS_NOT_ACTIVE');
  assert.equal(failureCategory(new Error('private connection string')), 'DATABASE_OR_SCHEMA_CHECK');
});

test('configuration diagnostics identify only fixed rule labels, never input values', () => {
  const valid = `postgresql://postgres.${ref}:example@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`;
  for (const [configuration, rule] of [
    [{ ...env(valid), GROW_EV_PROJECT_REF: 'other' }, 'PROJECT_REF'],
    [{ ...env(valid), GROW_EV_DATABASE_URL: undefined }, 'DATABASE_URL_REQUIRED'],
    [{ ...env(valid), GROW_EV_DATABASE_CA_FILE: undefined }, 'CA_FILE_REQUIRED'],
    [env(`'${valid}'`), 'URL_PARSE'],
    [env(valid.replace('postgresql:', 'https:')), 'PROTOCOL'],
    [env(valid.replace('pooler.supabase.com', 'private.example.org')), 'DEV_HOST'],
    [env(valid.replace(`postgres.${ref}`, 'different-private-user')), 'USERNAME'],
    [env(valid.replace(`postgres.${ref}`, '%ZZ')), 'USERNAME_ENCODING'],
    [env(valid.replace(':5432', ':6543')), 'SESSION_PORT'],
    [env(valid.replace(/\/postgres$/, '/private-database')), 'DATABASE_NAME'],
    [env(`${valid}?ssl=false`), 'SSL_PARAMETER'],
  ]) {
    assert.throws(() => devConnection(configuration), error => {
      assert.equal(failureCategory(error), `CONFIGURATION (${rule})`);
      assert.equal(error.message.includes('private'), false);
      return true;
    });
  }
  assert.equal(failureCategory(new Error('CONFIGURATION (private-secret)')), 'DATABASE_OR_SCHEMA_CHECK');
});
