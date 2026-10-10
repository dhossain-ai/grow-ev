import { createHash, X509Certificate } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import tls from 'node:tls';
import pg from 'pg';
import { pathToFileURL } from 'node:url';
import { devConnection } from './preflight-ocpi.ts';

// Public fingerprint of the official prod-ca-2021.crt inspected locally.
const OFFICIAL_CA_FILE_SHA256 = '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7';
const OFFICIAL_CA_FINGERPRINT256 = '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA';
const SSL_REQUEST = Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]);

type ProbeResult = { tlsAuthorized: boolean; tlsVersion?: string; chainLength?: number; peerLeafFingerprint256?: string };

async function probe(host: string, port: number, ca: string, negotiation: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const fail = (error: NodeJS.ErrnoException) => {
      const code = error.code && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'NETWORK_OR_TLS_ERROR';
      reject(Object.assign(new Error('Credential-free TLS probe failed'), { safeCode: code }));
    };
    const timeout = setTimeout(() => socket.destroy(Object.assign(new Error(), { code: 'ETIMEDOUT' })), 12_000);
    socket.once('error', fail);
    socket.once('connect', () => {
      const beginTls = () => {
        socket.removeListener('error', fail);
        const secure = tls.connect({ socket, servername: host, ca, rejectUnauthorized: true,
          ...(negotiation === 'direct' ? { ALPNProtocols: ['postgresql'] } : {}) }, () => {
          const peer = secure.getPeerCertificate(true);
          let chainLength = 0;
          let current = peer;
          const seen = new Set<string>();
          while (current?.raw && !seen.has(current.fingerprint256 ?? '')) {
            seen.add(current.fingerprint256 ?? '');
            chainLength++;
            if (!current.issuerCertificate || current.issuerCertificate === current) break;
            current = current.issuerCertificate;
          }
          clearTimeout(timeout);
          resolve({ tlsAuthorized: secure.authorized, tlsVersion: secure.getProtocol() ?? undefined,
            chainLength, peerLeafFingerprint256: peer.fingerprint256 });
          secure.destroy();
        });
        secure.setTimeout(12_000, () => secure.destroy(Object.assign(new Error(), { code: 'ETIMEDOUT' })));
        secure.once('error', fail);
      };
      if (negotiation === 'direct') { beginTls(); return; }
      socket.once('data', (response) => {
        if (response[0] !== 0x53) {
          clearTimeout(timeout);
          socket.destroy();
          reject(Object.assign(new Error('PostgreSQL server declined SSLRequest'), {
            safeCode: response[0] === 0x4e ? 'POSTGRES_SSL_UNSUPPORTED' : 'POSTGRES_SSL_NEGOTIATION',
          }));
          return;
        }
        beginTls();
      });
      socket.write(SSL_REQUEST);
    });
  });
}

async function main(): Promise<void> {
  const url = devConnection(process.env);
  const originalUrl = new URL(url.href);
  const sslUriParameterNames = ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslnegotiation', 'sslpassword']
    .filter(name => originalUrl.searchParams.has(name));
  const caBuffer = await readFile(process.env.GROW_EV_DATABASE_CA_FILE!);
  const ca = caBuffer.toString('utf8');
  const caCert = new X509Certificate(ca);
  const caFileSha256 = createHash('sha256').update(caBuffer).digest('hex');
  type InspectableClient = pg.Client & {
    connectionParameters: { host: string; port: number; ssl: unknown };
    sslNegotiation: string;
  };
  const client = new pg.Client({ connectionString: url.href, ssl: { rejectUnauthorized: true, ca },
    connectionTimeoutMillis: 12_000, application_name: 'grow-ev-credential-free-tls-diagnostic' }) as InspectableClient;
  const parameters = client.connectionParameters;
  const sslConfig = parameters.ssl;
  const caReceived = typeof sslConfig === 'object' && sslConfig !== null &&
    'ca' in sslConfig && sslConfig.ca === ca && 'rejectUnauthorized' in sslConfig && sslConfig.rejectUnauthorized === true;
  const hostReceived = parameters.host === url.hostname;
  const portReceived = parameters.port === 5432;
  const tlsNegotiation = client.sslNegotiation;
  const pgSendsSni = hostReceived && net.isIP(parameters.host) === 0;
  const output = {
    configuration: {
      devTargetValidated: true,
      protocol: 'postgresql',
      poolerHostShape: url.hostname.endsWith('.pooler.supabase.com'),
      portIsSession5432: url.port === '5432' || url.port === '',
      pgHostMatchesParsedTarget: hostReceived,
      pgPortIs5432: portReceived,
      tlsNegotiation,
      sniWillUseParsedHostname: pgSendsSni,
      sslUriParameterNames,
      sslParameterRejectedByGuard: !url.searchParams.has('ssl'),
      nodePostgresReceivesCaAndStrictVerification: caReceived,
    },
    ca: {
      pemHasOneCertificate: (ca.match(/-----BEGIN CERTIFICATE-----/g) ?? []).length === 1,
      certificateIsCa: caCert.ca,
      fileBytesExactlyMatchLocalOfficial: caFileSha256 === OFFICIAL_CA_FILE_SHA256,
      fileSha256: caFileSha256,
      certificateFingerprintMatchesLocalOfficial: caCert.fingerprint256 === OFFICIAL_CA_FINGERPRINT256,
      certificateFingerprint256: caCert.fingerprint256,
    },
  };
  console.log(JSON.stringify(output, null, 2));
  if (!Object.values(output.configuration).every(value => typeof value === 'boolean' || value === 'postgres')) {
    throw Object.assign(new Error(), { safeCode: 'NODE_POSTGRES_TLS_CONFIGURATION' });
  }
  if (!caCert.ca || caCert.fingerprint256 !== OFFICIAL_CA_FINGERPRINT256) {
    throw Object.assign(new Error(), { safeCode: 'CA_CERTIFICATE_IDENTITY' });
  }
  if (tlsNegotiation !== 'postgres' && tlsNegotiation !== 'direct') {
    throw Object.assign(new Error(), { safeCode: 'NODE_POSTGRES_TLS_NEGOTIATION' });
  }
  const result = await probe(parameters.host, parameters.port, ca, tlsNegotiation);
  console.log(JSON.stringify({ sniMatchesParsedHostname: pgSendsSni, serverCertificateAuthorizedForSniHost: result.tlsAuthorized,
    tlsVersion: result.tlsVersion, chainLength: result.chainLength, peerLeafFingerprint256: result.peerLeafFingerprint256 }, null, 2));
  if (!result.tlsAuthorized) throw Object.assign(new Error(), { safeCode: 'TLS_HOSTNAME_OR_CHAIN' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main().catch(error => {
  const safeCode = typeof error === 'object' && error !== null && 'safeCode' in error ? String(error.safeCode) :
    typeof error === 'object' && error !== null && 'code' in error && /^[A-Z0-9_]+$/.test(String(error.code)) ? String(error.code) : 'TLS_DIAGNOSTIC_ERROR';
  console.error(`Credential-free TLS diagnostic failed: ${safeCode}. Connection details withheld.`);
  process.exitCode = 1;
});
