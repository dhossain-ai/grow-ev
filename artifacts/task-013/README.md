# TASK-013 read-only audit evidence

`history-audit-before.json` contains aggregate counts, per-time status totals,
next-observation label counts, diagnostic persistence confusion counts, immutable
local evidence hashes and measured database sizes. It contains no credentials or
full source rows. It describes the dataset before scheduled collection.

`read-only-audit.sql` was executed against the guarded DEV target with strict
client CA/hostname TLS: all SELECTs passed in a READ ONLY transaction, rolled back.
Catalog/table inspection found no historical observation/snapshot/prediction table.
Database size is measured, not a quota, provisioned disk estimate or invoice.

Full source-row snapshots remain private under ignored
`services/ingestion/.scratch/`; hashes and names are listed in TASK-013.
No raw evidence or dataset was uploaded to GitHub artifacts or Google Colab.

## Label counting method

1. Select retained snapshots backed by genuine SUCCESS/COMPLETE polls, excluding
   any `pagination_metadata.replaySha256` poll.
2. Verify every saved EVSE observation falls within that genuine poll window.
3. Compare canonical location, EVSE and connector UUID sets across saved times;
   compare EVSE/location links and connector EVSE/standard/power associations.
4. Rewind each current normalized/original status through newer transitions and
   compare with every corresponding actual saved status. All 17,508 pairs matched.
5. Group the actual saved EVSE rows by saved canonical location and connector
   standard; deduplicate `(evse_id, standard)` before counting.
6. Pair only consecutive genuine observations. A next group with AVAILABLE is
   negative; no AVAILABLE and no UNKNOWN is positive; no AVAILABLE with UNKNOWN
   is excluded. Require matching group/topology evidence at both endpoints.
7. Preserve actual gap and exclusion counts. Neither hours-long pair meets the
   proposed 20–40-minute evaluation window; eligible near-30-minute pairs are zero.

These are actual observed labels. Outages count as known no-availability, not
evidence of congestion. UNKNOWN never becomes a fabricated positive. Counts do
not describe physically verified capacity or calibrated probability.

## Validation boundaries

- Collector/preflight: ingestion TypeScript, 16 non-DB tests, six cutoff checks,
  actionlint and all ten guarded disposable WSL PostgreSQL checks passed.
- Windows disposable DB connection attempt failed ECONNREFUSED; Linux WSL passed.
- SQL audit, actual saved-membership/topology checks and status rewind passed.
- No CatBoost training/evaluation, Colab export/upload, migration, model artifact,
  prediction write or AI deployment was performed.

See `tasks/active/TASK-013.md` for proposed schema, retention, cost assumptions,
leakage controls and approval gates.
