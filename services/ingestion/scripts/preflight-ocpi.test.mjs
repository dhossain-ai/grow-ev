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
    ['ERR_TLS_CERT_ALTNAME_INVALID', 'TLS'], ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'TLS'],
    ['42501', 'DATABASE_AUTHORIZATION'], ['53300', 'DATABASE_CONNECTION_LIMIT']]) {
    assert.equal(failureCategory({ code, message: 'private connection string' }), category);
  }
  assert.equal(failureCategory(new Error('UNFINISHED_POLL')), 'UNFINISHED_POLL');
  assert.equal(failureCategory(new Error('private connection string')), 'DATABASE_OR_SCHEMA_CHECK');
});
