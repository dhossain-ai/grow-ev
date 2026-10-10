-- DEV audit only. No migrations, source calls or writes. Strict client TLS is
-- configured by the caller; pg_stat_ssl describes the backend hop via Supavisor.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';

SELECT current_timestamp AS checked_at,
       current_setting('transaction_read_only') AS read_only,
       pg_database_size(current_database()) AS database_bytes;

SELECT id, started_at, completed_at, outcome, completeness,
       pagination_metadata->'counts' AS counts,
       pagination_metadata->'transitions' AS transitions,
       pagination_metadata->>'replaySha256' IS NOT NULL AS replay
FROM public.source_poll_runs
WHERE source = 'via-lietuva-ocpi'
ORDER BY completed_at;

SELECT count(*) FILTER (WHERE outcome = 'SUCCESS' AND completeness = 'COMPLETE')
         AS successful_poll_records,
       count(*) FILTER (WHERE outcome = 'SUCCESS' AND completeness = 'COMPLETE'
         AND NOT pagination_metadata ? 'replaySha256') AS genuine_poll_records,
       count(DISTINCT completed_at) FILTER (
         WHERE outcome = 'SUCCESS' AND completeness = 'COMPLETE'
         AND NOT pagination_metadata ? 'replaySha256') AS genuine_collection_times
FROM public.source_poll_runs WHERE source = 'via-lietuva-ocpi';

SELECT schemaname, relname, pg_total_relation_size(relid) AS total_bytes,
       pg_relation_size(relid) AS heap_bytes,
       pg_indexes_size(relid) AS index_bytes
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;

SELECT table_schema, table_name FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  AND (table_name ILIKE '%snapshot%' OR table_name ILIKE '%histor%'
    OR table_name ILIKE '%observ%' OR table_name ILIKE '%predict%');

SELECT count(*) AS evses, min(last_observed_at) AS oldest,
       max(last_observed_at) AS newest,
       count(*) FILTER (WHERE source_last_updated_at IS NULL) AS unknown_source_age
FROM public.charging_evses WHERE source = 'via-lietuva-ocpi';

SELECT poll_run_id, count(*) AS transitions
FROM public.evse_status_transitions GROUP BY poll_run_id ORDER BY poll_run_id;

-- Current snapshot label cohorts only, NOT historical training labels. Historical
-- labels require retained per-poll membership/topology and genuine timestamps.
WITH members AS (
  SELECT DISTINCT e.location_id, c.standard, e.id, e.current_status
  FROM public.charging_evses e JOIN public.charging_connectors c ON c.evse_id = e.id
  WHERE e.source = 'via-lietuva-ocpi' AND c.standard IS NOT NULL
), groups AS (
  SELECT location_id, standard, count(*) AS compatible,
         count(*) FILTER (WHERE current_status = 'AVAILABLE') AS available,
         count(*) FILTER (WHERE current_status = 'UNKNOWN') AS unknown
  FROM members GROUP BY location_id, standard
)
SELECT standard, count(*) AS station_connector_groups,
       count(*) FILTER (WHERE available > 0) AS negative_at_this_observation,
       count(*) FILTER (WHERE available = 0 AND unknown = 0) AS positive_at_this_observation,
       count(*) FILTER (WHERE available = 0 AND unknown > 0) AS unknown_target
FROM groups GROUP BY standard ORDER BY standard;
ROLLBACK;
