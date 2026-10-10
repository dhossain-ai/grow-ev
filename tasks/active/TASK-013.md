# TASK-013 — Historical Dataset Audit and CatBoost Plan

Status: Read-only audit and proposal prepared; implementation, migrations, training
and prediction writes await review. No AI repository created.
Date: 2026-10-10

## Scope

Audit DEV `heafsrqaytsfthfcxmqu` through strict verified client TLS and a
REPEATABLE READ / READ ONLY transaction, rolled back. Inspect only the existing
five charging tables, catalog/history-table names and database/relation sizes.
No source polling was performed by this audit. TASK-012 recurring collection is
separately authorized. Driver, TomTom and recommendation engine remain unchanged.

## Verified dataset before the first scheduled poll

Audit time: 2026-10-10 13:51:57.339 UTC / 16:51:57 Europe/Vilnius.

- Current rows: 1,984 locations, 5,836 EVSEs, 5,838 connectors.
- Four SUCCESS/COMPLETE poll records; **three genuine source collection times**.
  Replay `fe99a329-3d21-44b8-90c3-7abd0b19ef49` has `replaySha256` and is excluded.
  A successful replay with newly assigned timestamps is not another measurement.
- 1,067 genuine normalized/original-status transitions: 66 plus 1,001.
- No historical EVSE observation, snapshot or prediction tables found. Current
  EVSE rows overwrite status/last observation; transitions record changes only.
- All 5,836 parsed provider update timestamps are NULL. Original strings exist;
  do not assign an assumed timezone. Observed freshness is not publication age.

| Genuine poll | Observation range UTC | Completed UTC | EVSEs |
| --- | --- | --- | --- |
| `dcea556f-9796-41da-8764-69146f0844af` | Oct 9 21:50:50.105–21:50:53.903 | Oct 9 21:51:05.330 | 5,836 |
| `125766b8-62ec-45d9-8af0-c3467437558a` | Oct 10 00:46:01.044–00:46:04.628 | Oct 10 00:46:23.917 | 5,836 |
| `f8ed5750-a7e0-45c4-96f0-79fc21055503` | Oct 10 13:29:17.038–13:29:20.841 | Oct 10 13:31:32.677 | 5,836 |

### Reconstruction and evidence limits

Complete snapshots for these three times **are available in retained private local
evidence**, not in a database snapshot table. Saved full rows establish per-poll
membership, association and connector standard/power. Canonical UUID sets and
EVSE-location/connector topology match across all three saved snapshots.
Reversing newer transition chains reproduces all 17,508 saved normalized AND
original EVSE statuses exactly (5,836 × 3), including unchanged states.

The 66 overnight transitions have `previous_observed_at=21:52:03.348 UTC`, the
replay-assigned timestamp. Their status change is genuine, but that bound is not
an independent source observation. Duration/lag features must refer back to the
saved genuine initial observations (21:50:50.105–21:50:53.903), preserve interval
uncertainty and exclude replay clock values. Binary labels above use saved genuine
states and are unaffected; change-interval timestamps must not be used blindly.

Database-only transition reconstruction can infer a historical status under a
continuous-membership assumption. It cannot certify every unchanged EVSE was
present at each poll, recover all unchanged observation timestamps, or prove
historical connector/location versions. COMPLETE traversal is not an EVSE
membership log; the collector retains omitted records. Never label those assumed
reconstructions as complete snapshots without the saved evidence.

Immutable files under ignored `services/ingestion/.scratch/`:

| File | SHA-256 |
| --- | --- |
| `dev-first-state.json` | `78303fc3e76174d1557e3a3516c9924f56128c72f8663aef371f106c98b5f4de` |
| `task012-approved-baseline.json` | `e504b80cf7aae2c996812ecccffee1b449a045d23e1ab98f1fee2e43eeb5494b` |
| `task012-approved-after.json` | `05fe228a97d518f88bcdc859aeca2f69da7ee04348981e86b1a5c4f124a742da` |

New immutable read-only audit: `.scratch/task013-audit-before.json`.
Sanitized aggregate evidence: `artifacts/task-013/history-audit-before.json`.
Read-only size/count SQL: `artifacts/task-013/read-only-audit.sql`.
These local snapshots need an approved durable archive; they are not remote
retention guarantees. Raw full-row evidence is not committed or sent to Colab.

## Target and genuine example counts

Row grain: canonical station UUID × connector standard × genuine successful poll.
Count each compatible canonical EVSE once per connector standard. Multiple
connectors on one EVSE never inflate independently usable capacity.

Target at the **next genuine observation**:

- `y=0`: at least one compatible EVSE reports AVAILABLE.
- `y=1`: compatible capacity exists, zero AVAILABLE and all compatible statuses
  are known. Includes occupied and out-of-service statuses; this target is not
  synonymous with congestion, charging completion or physical arrival availability.
- `y=NULL`: no AVAILABLE but at least one UNKNOWN, missing membership/status,
  incomplete/unverified poll or unsupported/unknown connector evidence. Exclude
  from binary training and report the exclusions. A group with no compatible
  EVSE at the target is excluded, not invented as zero availability.

Each saved time has 2,445 station/connector groups: 835 CCS2, 1,428 Type 2 and
182 CHAdeMO. There are 5,837 compatible EVSE/standard memberships, from 5,836
EVSEs; an EVSE offering two standards can belong to two groups.

| Consecutive genuine times | Gap between poll completion | Positive | Negative | Unknown target excluded |
| --- | --- | --- | --- | --- |
| Initial → overnight | 10,518.587 s (2h55m18.587s) | 328 | 2,105 | 12 |
| Overnight → manual afternoon | 45,908.760 s (12h45m08.760s) | 699 | 1,733 | 13 |
| Total | Two temporal intervals | **1,027** | **3,838** | **25** |

Thus 4,865 real labeled station/connector rows, 4,890 candidate rows and
11,672 EVSE-level adjacent status pairs. These are only **two independent
collection intervals**, not thousands of independent temporal samples.
There are **zero near-30-minute pairs** (proposed acceptance: actual gap 20–40
minutes). Do not train a 30-minute predictor on these hours-long gaps or use the
realized future gap as an input feature. A later scheduled poll adds genuine
evidence only when its execution and retained snapshot are verified.

No model can receive a defensible train/validation/test assessment from two
intervals. This is dataset readiness analysis, not CatBoost accuracy evidence.

## Recommended feature/export schema (proposal)

| Field(s) | Meaning / rule |
| --- | --- |
| `schema_version`, `dataset_version`, `source` | Versioned interpretation and Via Lietuva attribution |
| `station_id`, `connector_standard`, `feature_poll_id` | Canonical identity and row key; IDs retained for joins/splits, not automatically model features |
| `feature_available_at_utc` | Successful poll completion, earliest point the full feature snapshot could have been served |
| `observed_oldest_at_utc`, `observed_newest_at_utc` | True compatible member observation bounds |
| `compatible_evses`, nine normalized status counts | Distinct EVSE counts; status counts must sum to capacity; UNKNOWN separate |
| `unknown_source_age_count`, `membership_complete`, `topology_hash` | Missing provider age and scope/version evidence |
| `connector_max_power_kw`, `operator_id` | Nullable snapshot-time metadata; operator key is source/country/party, not an inferred company mapping; power is advertised maximum, not measured rate |
| `local_hour`, `local_weekday`, `utc_offset_minutes` | Derived from feature time using Europe/Vilnius, preserving DST offset |
| `previous_gap_seconds`, `lag1_available`, `lag2_available`, `recent_change_count` | Past-only values; NULL when insufficient retained history; never fill backward from future |
| `target_poll_id`, `target_observed_oldest_at_utc`, `target_observed_newest_at_utc`, `actual_gap_seconds` | Label/audit columns only, explicitly excluded from feature matrix; actual gap is target's oldest observation minus feature availability time |
| `next_no_compatible_available`, `label_quality`, `exclusion_reason` | Real outcome or NULL, with reproducible target policy |

The historical table above reports poll-completion gaps for easy audit; production
label eligibility must use the actual target observation range relative to when
features were available. Require a nonoverlapping target range inside the versioned
horizon tolerance. Next target completion/observation fields never enter features.

Use exact OCPI standards already used by the application. Validate bounded
counts, UTC chronology, successful nonreplay poll IDs, no duplicate row keys,
membership and connector changes, and feature availability before target time.
Do not include tariffs, TomTom inputs or simulated waiting/charging labels.

## Compact retention proposal — approval required

Prefer station/connector aggregates for this target, with a compressed full EVSE
membership/status/topology artifact for replayable audits. Change-only history is
insufficient when unchanged or omitted members affect aggregate availability.

1. New private `station_connector_observations` table: primary key
   `(poll_run_id, location_id, connector_type_code)`; FK to existing poll/location;
   explicit observation bounds, compatible count and nine smallint status counts,
   unknown source-age count, quality flags, topology hash/version. Code dictionary
   and schema version must preserve exact standards; reject count overflow.
   Rows represent only members actually fetched in that poll, never retained stale
   current rows. Persist aggregates and SUCCESS/current state in the same collector
   transaction; a failure must roll everything back. Existing collector behavior
   must pass disposable DB regressions before applying the addition.
2. New private `observation_archives` manifest: poll ID, exact schema/version,
   SHA-256, bytes, row counts, UTC observation bounds, storage path and archive
   outcome. A raw capture alone is not enough: the current capture envelope lacks
   exact per-page observation timestamps, and replay assigns new ones. Archive
   the parsed per-EVSE snapshot with genuine times and canonical membership too.
   On archive failure flag history unavailable; do not fabricate a retained poll.
3. Start with **7 days** of hot aggregate rows. Approved daily archival to private
   gzip/Parquet objects before pruning; immutable dated manifests and checksums.
   Keep **30 days** of compressed full snapshots and longer compact training
   exports only after storage/retention approval. Never delete unarchived rows,
   existing current entities or transition history as part of this proposal.
4. RLS/default client denial, no PUBLIC/anon/authenticated table privileges;
   narrowly scoped collector insert/export read roles. Separate private archive
   bucket/policies and a reviewed retention role; no credentials in app or Colab.

No migration files or storage buckets have been created. Table, transactional
writer, archive storage/policies and retention deletion require explicit review
and DEV migration approval. They are not needed to activate TASK-012.

### Database size and retention cost

Measured `pg_database_size`: **28,948,147 bytes / 27.607 MiB**.
Five public charging relations with indexes/TOAST: **9,502,720 bytes / 9.063 MiB**.
This is database/relation usage, not total provisioned disk, WAL, backups or an
account invoice. Supabase plan and storage allowance were not read from a dashboard.

At current coverage, 2,445 aggregate rows/poll × 48/day = 117,360 rows/day.
Budget **160–240 bytes/row including indexes** as a design estimate, to be measured
on a disposable implementation before approval:

| Retention | Rows | Estimated aggregate table/index bytes |
| --- | --- | --- |
| 1 day | 117,360 | 18.8–28.2 MB |
| 7 days | 821,520 | 131.4–197.2 MB |
| 30 days | 3,520,800 | 563.3–845.0 MB |

Seven days plus current size is roughly 160–226 MB before new indexes/manifests,
bloat, WAL and future source growth. Thirty days exceeds the Free 500 MB database
quota. Full EVSE-row retention is larger: 280,128 rows/day / 8,403,840 per 30 days.
Do not store repeated full JSON payloads in PostgreSQL.

Measured saved full after-state: 6,540,710 bytes raw / **824,776 bytes gzip**,
including some existing history. At that measured size (not a compression
guarantee), 48 archives/day ≈39.6 MB/day; 30 days ≈1.188 GB. Dedicated parsed
snapshots or Parquet may differ; measure exact format, bandwidth and archive cost.
Object bytes are separate from database quota.

Seven days of archives at that measured size is about 277 MB; 30 days is above
the official Free 1 GB object-storage allowance. Start with seven days if the
actual plan is Free. Paid plans include 100 GB object storage, then $0.021/GB-month;
1.188 GB would be about $0.025/month only if all of it were overage, before egress
and other usage. Verify actual plan/remaining quota before selecting a bucket or
retention period; no automatic plan upgrade or storage purchase is authorized.

Official [Supabase database/disk semantics](https://supabase.com/docs/guides/platform/database-size)
and [billing](https://supabase.com/docs/guides/platform/billing-on-supabase): Free
database quota 500 MB; paid disk includes 8 GB with $0.125/GB-month beyond allowance.
These proposed aggregates alone add about $0.070–$0.106/month only if the entire
0.563–0.845 GB is incremental overage on a paid plan, excluding base/compute,
archives/egress/backups. Do not infer a Free-plan overage purchase is available.

## Colab, training and evaluation proposal

After retention approval, export privately using a read-only repeatable snapshot.
Export only approved charging data/derived rows and provenance, never database URL,
keys, unrelated auth data or exact driver locations. Validate checksums and counts,
exclude replay/failure/partial/UNKNOWN-target rows, produce versioned Parquet plus
manifest and local audit of exclusions. User downloads/uploads the approved export
to Colab; do not give Colab live privileged Supabase access. No export/upload now.

For a demonstration, collect the authorized window first and honestly state its
short coverage. For product evaluation, seek separate approval for multiple days
including distinct rush/quiet periods; prefer at least a week before drawing
general conclusions. Coverage, positive/negative support and temporal diversity
are training gates, not a promise that a fixed row count ensures accuracy.

Candidate: CPU CatBoostClassifier, binary Logloss, modest depth/tree budget,
fixed random seed, bounded tuning and early stopping on chronological validation.
Pin the actual Python/CatBoost package versions when implementation begins.
Use snapshot-time connector/operator categories with explicit missing markers;
avoid high-cardinality station IDs in the first baseline model. `has_time=True`
preserves time order but does not replace an honest external temporal split.
[CatBoost parameters](https://catboost.ai/docs/en/references/training-parameters/common#has_time)
and [fit/evaluation API](https://catboost.ai/docs/en/concepts/python-reference_catboostclassifier_fit).

Split **whole poll time blocks**, never random station rows. Train on earlier
periods, tune/threshold on later validation, freeze then test once on untouched
latest period; purge rows whose target crosses a boundary. Keep a separate
station/operator holdout if making claims about unseen sites. Evaluate only
20–40-minute actual-gap pairs for a nominal next-30-minute model; preserve failure
gaps and label them unavailable rather than jumping hours ahead silently.

Persistence baseline: current group has no AVAILABLE and known statuses → predict
positive next time; current AVAILABLE → negative; unknown current group → abstain.
Score baseline/model on the same eligible labels and report baseline coverage.
Historical diagnostic confusion counts are retained in aggregate JSON; they are
hours-gap arithmetic, not 30-minute model evaluation. Report PR-AUC, ROC-AUC where
both classes exist, Brier/log loss with valid probability handling, precision/recall,
confusion matrix, prevalence, exclusions and performance by connector/time block.
For deterministic persistence use confusion/Brier; do not pretend 0/1 hard outputs
give finite unmodified log loss. Compare any smoothed baseline separately.
Report chronological calibration/reliability before calling scores calibrated
probabilities; do not publish accuracy improvements without untouched test evidence.

### Temporal leakage risks

- Random row splits put the same poll/shared conditions in train and test.
- Future transitions, last-current status, full-history durations and latest
  connector/location metadata can leak later information into earlier features.
- A full feature row becomes usable at commit/completion, not the earlier start
  or earliest page timestamp. Exclude training rows that ignore this latency.
- Future realized observation gaps, target status/counts and target-quality fields
  must be removed from model inputs; quality gates are offline cohort selection.
- Do not fit encoders/imputation/calibration using test data; `has_time` alone
  cannot prevent leakage from incorrectly constructed features or cohort splits.
- Replays and unchanged repeated snapshots do not create independent measurements.
  Current state age/source publication uncertainty must remain explicit.
- Replay writes contaminated the previous-observation bounds on 66 later genuine
  transitions; reconstruct duration/lag bounds from genuine retained evidence,
  not those replay timestamps. Do not interpolate unobserved intermediate states.

## Versioned artifact and Actions inference proposal

After successful evaluation and review, publish an immutable private artifact:
`model.cbm`, SHA-256, model/version ID, training Git SHA, dataset checksum,
feature/target schema, fixed feature order/categories, observed training range,
split manifest, exclusions, package versions, baseline/model metrics, calibration
status, selected threshold and limitations. CatBoost's native binary format is
supported by [save_model](https://catboost.ai/docs/en/concepts/python-reference_catboostclassifier_save_model).
No new AI repository is needed; a small later approved module in this repository
can own export/train/infer contracts without touching the driver.

Inference initially manual-only, then separately approve a dependency on verified
collector SUCCESS/COMPLETE, never an independent cron racing collection. Pin
artifact hash and Python dependencies, reuse exact feature builder, DEV guard,
strict TLS, concurrency/cutoff and small runner timeout. Replays, partial polls,
missing history/unsupported groups, stale/future input or model/schema mismatch
must withhold predictions. No inference job, model download or writes now.

Proposed private `station_connector_predictions` migration: canonical station,
standard, feature poll ID, model/version, calculated time, input observation
bounds, nominal horizon, expiry, score, threshold/calibration status, quality and
feature/artifact hashes. Unique key `(feature_poll_id, station_id, connector,
model_version)` for idempotent writes; bounded score and chronology constraints.
Server-only least privileges and default-deny RLS. Keep predictions separate from
observations; expired/missing predictions are unavailable, never current capacity.
Any public read RPC/UI integration is another approved task.

## Checks and remaining gates

- Read-only strict TLS audit passed; no migrations or ML writes.
- Three full saved snapshots: canonical membership/topology equality passed;
  all 17,508 raw/normalized status reversals matched actual saved evidence.
- Actual derived label counts above; no invented historical times or labels.
- TASK-012 ingestion TypeScript, 16 non-DB tests, six cutoff tests and actionlint
  passed. Windows DB test failed ECONNREFUSED (WSL loopback not accessible);
  unchanged disposable PostgreSQL suite executed in WSL: all ten checks passed.
- No training, Colab upload, new database schema, prediction writes or model/runtime
  validation performed. They remain explicitly unrun.
- Remaining: first scheduled execution/snapshot evidence; durable historical
  archive and migration/retention review; enough near-30-minute temporal coverage;
  chronological evaluation against persistence; approval before any prediction write.

Stop for review. Planning/audit is ready; TASK-013 implementation is not complete.
