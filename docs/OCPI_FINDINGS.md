# Via Lietuva OCPI Findings

Verified: 2026-10-09 against the public Via Lietuva endpoints.

## Coverage correction and reproducible investigation

**The initial 93-location response was only the first source window.** The
earlier Vilnius/status/tariff findings below describe that first-window sample,
not national or complete Vilnius coverage. Pagination is the confirmed main
cause of the original discrepancy. The old script discarded HTTP headers and
made a single request; it now scans all advertised windows and validates unique
composite location identities.

Run from repository root (Node 22.18+ with native TypeScript support):

```powershell
node services/ingestion/scripts/investigate-ocpi.ts --verify-coverage
pwsh -NoProfile -File services/ingestion/scripts/investigate-datex.ps1
node --test services/ingestion/scripts/investigate-ocpi.test.mjs
apps/driver/node_modules/.bin/tsc.cmd -p services/ingestion/tsconfig.json
```

The PowerShell diagnostic uses the platform XML parser with DTDs disabled, keeps
responses in memory and prints aggregate counts. Neither script saves raw feeds.

### Pagination behaviour verified on 2026-10-09

- Default response: 93 locations; `X-Total-Count: 3273`; no `X-Limit` header;
  `Link: </ocpi/2.3.0/locations?&limit=100>; rel="next"`.
- `limit=2&offset=0` returns one location (258), while `offset=2` returns two
  (259 and 260): parameters affect the selection, but returned counts can be
  shorter than the source window.
- `limit=1000` at offsets 0, 1000, 2000 and 3000 returns respectively 886,
  783, 141 and 174 locations: 1,984 unique composite identities in total.
- `offset=4000` returns no locations and no next link.
- `limit=10000&offset=0` returns exactly the same 1,984 location identities as
  the four-window scan, with no next link. Repeated scans reproduced these totals.
- Explicit-query `Link` values contain a second `?`, and the first explicit
  page's link does not advance the offset. Blindly following these links is unsafe.
- `X-Total-Count` is not the returned location count. The investigation advances
  by requested window size, never stops on a short/empty intermediate window,
  rejects duplicate location identities or changing totals, and caps traversal.

The reason 3,273 advertised entries produce 1,984 serialized locations remains
unconfirmed. Filtering or grouping before serialization is plausible, but no
provider statement or implementation evidence was available. The result is
complete for the tested endpoint windows, not proof of complete national inventory.

### Verified source comparison

Snapshots fetched around `2026-10-09T20:02Z`. Entity definitions differ:

| Source | Locations | EVSEs | Operators | Notes |
| --- | ---: | ---: | ---: | --- |
| OCPI all windows | 1,984 | 5,824 | 13 stable party IDs | 5,826 connectors; advertised total 3,273 |
| OCPI Vilnius city match | 888 | 2,097 | 11 stable party IDs | 2,097 connectors |
| Official portal counters | Not directly comparable | Not verified as EVSEs | 13 displayed | 3,291 stations, 5,822 charging access points, 1,834 parks |
| DATEX static table | 3,672 sites / stations | Not verified | Stable count unavailable; 29 provider names | 18,283 distinct refill-point IDs; 46,601 connector elements |
| DATEX status publication | 3,706 site statuses | Not verified | Not available in this publication | 15,749 point-status entries; includes REMOVED |

Portal figures were read from the public rendered HTML at
[the official portal](https://ev.vialietuva.lt/); its station, access-point and
park counters must not be equated automatically to OCPI locations and EVSEs.
The remaining difference of two charging access points versus OCPI EVSEs is
unexplained; separate fetch times or different counting rules are possibilities,
not verified causes.

The full OCPI Vilnius snapshot had AVAILABLE 1,649, CHARGING 262,
INOPERATIVE 76, OUTOFORDER 107 and UNKNOWN 3. Five Vilnius connectors lacked
tariff references. The previous claim of 16 resolved tariffs applies only to
the original first-window subset; complete-city tariff resolution was not rerun.

### Stable OCPI operator identities

Count by `(country_code, party_id)`, not name. All observed country codes were LT.

| Party ID | Published name | National locations |
| --- | --- | ---: |
| 008 | Eleport, UAB | 19 |
| E85 | Enefit, UAB | 163 |
| ELD | Eldrive Lithuania, UAB | 184 |
| ETR | Elektrum Lietuva, UAB | 85 |
| EVI | EV Infrastruktūra, UAB | 20 |
| IBG | In Balance grid, UAB | 756 |
| IGN | Ignitis, UAB | 380 |
| IKR | Įkrautas, UAB | 56 |
| ION | IONITY GmbH | 3 |
| LLT | Lidl Lietuva, UAB | 37 |
| NL1 | Neste Lietuva, UAB | 3 |
| SET | VIRŠI Lietuva, UAB | 1 |
| STR | Stuart Energy, UAB | 277 |

### DATEX differences and broader public coverage

Both DATEX endpoints are documented on the official open-data page and
accessible without credentials. Static site IDs and refill-point IDs were
unique. All 3,672 static sites had a status site; the status feed contained
34 additional site IDs without a matching static record. Static providers have
names but no stable organisation ID on their `energyProvider` objects, so 29
distinct names are not a verified count of 29 stable operator identities.

All 13 OCPI operator names occur in DATEX. Its additional names include Stova,
EMSI, Čia ir ten, Skulas, Palangos komunalinis ūkis, Skuodo šiluma and municipal
organisations for Biržai, Birštonas, Ignalina, Kazlų Rūda, Kelmė, Lazdijai,
Pakruojis, Šalčininkai, Tauragė and Varėna. The helper prints the full name list.

Matching numeric suffixes (`OCPI id` to `EGI-S-{id}`) gave 1,980 shared IDs,
1,692 DATEX-only IDs and four OCPI-only IDs. This is a diagnostic overlap rule,
not a documented cross-format identity contract.

DATEX groups points differently: static site `EGI-S-258` has a refill point
`LT-IBG-P-A9MY` with 14 connector elements, while OCPI location 258 has two EVSEs
and two connectors. DATEX point-status IDs are local indexes such as `0` and `1`,
not those static refill-point IDs. Static and dynamic points cannot be joined
by ID alone, and these XML element counts cannot be labelled independent capacity.
DATEX supplies timestamp offsets, unlike the OCPI object's offset-free dates.

### Recommended ingestion direction and remaining gates

Use fully paginated OCPI as the initial EVSE/status/connector source: it now
covers the 13 published OCPI operator identities and roughly the portal's access
point total, and its EVSE hierarchy fits Grow EV's model. The accessible DATEX
static publication is the broader infrastructure inventory candidate, with its
status publication as a companion after mapping validation.

Before production ingestion, obtain clarification on OCPI advertised-count
semantics, malformed links, source filtering, DATEX point/connector mapping,
cross-publication identity and publication scope. Assess removed/inactive
records and freshness explicitly. No available source has been demonstrated to
be an authoritative complete inventory of usable national capacity.

## Earlier first-window findings (retained as dated sample evidence)

## Sources and method

- Locations: `https://ev.vialietuva.lt/ocpi/2.3.0/locations`
- Tariffs checked separately: `https://ev.vialietuva.lt/ocpi/2.3.0/tariffs`
- Official open-data page: `https://ev.vialietuva.lt/atviri-duomenys-1`
- DATEX II static and status publications were reachable as XML.

The official page describes the data as real-time and licenses it under CC BY
4.0 / ODC-BY. A single fetch is only a current observation; update latency and
reliability have not been measured longitudinally.

## Verified response structure

The locations response is an OCPI-style envelope with `timestamp`,
`status_code`, `status_message`, and `data`. Each observed location contained:

- source identity: `country_code`, `party_id`, and `id`;
- display data: `name`, address, city, country, coordinates, directions and
  facilities;
- operator and owner names, websites, and support contact fields;
- zero or more EVSE objects;
- location `last_updated`, time zone, publication and access information.

Each EVSE exposed `uid`, `evse_id`, `status`, connectors, optional capabilities
and parking data, and `last_updated`. Connectors exposed their identifier,
standard, cable/socket format, power type, voltage, amperage,
`max_electric_power` in watts, tariff references, and `last_updated`.

The saved fixture is a reduced, unmodified subset of one observed location. It
is representative of shape, not national status distribution.

## Vilnius coverage snapshot

Vilnius was identified by a trimmed, case-insensitive exact match on the
published `city` value. This is reproducible but depends on provider labelling;
it excludes nearby municipality records such as Grigiškės and does not prove a
point is inside the administrative boundary. A future ingestion service should
use coordinates plus an authoritative boundary when that distinction matters.

At response timestamp `2026-10-09T19:54:33Z`:

| Measure | Count |
| --- | ---: |
| All locations | 93 |
| Vilnius locations | 64 |
| Vilnius EVSEs | 240 |
| Vilnius connectors | 240 |
| AVAILABLE EVSEs | 184 |
| CHARGING EVSEs | 21 |
| INOPERATIVE EVSEs | 23 |
| OUTOFORDER EVSEs | 12 |
| Unknown or other status EVSEs | 0 |
| Distinct named operators | 2 |

The two published operator names were `Ignitis, UAB` and
`In Balance grid, UAB`. Connector standards were CHAdeMO (26), Type 2 (124),
and CCS Combo 2 (90). Advertised maximum power ranged from 11 kW to 200 kW.

`CHARGING` is an observed source status. It does not prove energy flowed for the
whole interval and cannot establish post-charge idling.

## Capacity interpretation

All 240 Vilnius EVSEs in this snapshot had exactly one connector. Therefore the
snapshot's EVSE and connector counts happen to match. This must not become a
general capacity rule: OCPI permits multiple connectors per EVSE and defines an
EVSE as able to charge only one vehicle at a time. Independently usable capacity
should be counted at EVSE level unless operator-specific evidence proves a
different physical model.

## Identifiers and data quality

No Vilnius location lacked its name, named operator, coordinates, EVSE or
location timestamp. No Vilnius EVSE lacked `evse_id`, connectors, power or an
EVSE timestamp, and every connector had at least one tariff reference.

Important inconsistencies and limitations:

- Location `id`, EVSE `uid`, and connector `id` were JSON numbers, although
  standard OCPI identifiers are strings. Parsers must accept the observed wire
  format and normalize without losing source identity.
- Two `evse_id` values occurred twice in Vilnius. The combination of source
  party, location and EVSE identity was unique; `evse_id` alone is unsafe as a
  database key.
- Optional parking, facility, image, capability and energy-mix arrays were
  frequently empty; empty publication is not evidence that a feature is absent.
- The feed does not expose parking-bay sensors, session energy, charging
  completion, queue length, reservations, reliability history, or measured
  utilization.

## Timestamps and update behaviour

The envelope timestamp used UTC (`Z`) and changed between requests. Location,
EVSE and connector `last_updated` strings had no UTC offset, so their absolute
instants must not be assumed without provider clarification. In the Vilnius
snapshot, location dates ranged from `2026-07-29T09:27:15` to
`2026-10-09T22:51:09`, EVSE dates from `2026-07-29T09:25:57` to
`2026-10-09T22:51:09`, and connector dates from `2024-09-02T15:49:50` to
`2026-10-08T09:30:33`.

Two requests three seconds apart produced new envelope timestamps and no EVSE
status or EVSE timestamp changes. A later run about two minutes afterward had
one fewer `AVAILABLE` and one more `INOPERATIVE` EVSE, showing that the
published aggregate can change between polls. These brief observations do not
establish latency or update frequency. Grow EV must store its own observation
time separately from source timestamps and measure changes over days before
defining freshness thresholds.

## Tariffs and prices

Locations did not contain direct price amounts. Their connectors contained
`tariff_ids`. The separate public tariffs endpoint was reachable: all 16
distinct tariff IDs referenced by Vilnius connectors matched a tariff in the
snapshot and used EUR. Price components included `ENERGY`, `FLAT`, and
`PARKING_TIME`, confirming that a single price-per-kWh field would lose meaning.
Some fields such as VAT inclusion and minimum/maximum price were null.

This is current feed coverage, not a guarantee that every future reference will
resolve or that displayed prices cover memberships, roaming or payment rules.

## Implications for Grow EV Brain

From a current snapshot Grow EV can calculate published available/unavailable
EVSE counts, connector compatibility, advertised maximum power, nearby capacity
and data completeness. It may display tariff structures only after parsing and
labelling their conditions.

Historical observations are required for occupancy episodes, typical
availability, congestion by time, outage duration, transition frequency,
freshness behaviour and any evaluated forecast. These remain observations, not
proof of delivered energy or completed charging.

Operator partnerships or other verified sources are required for authoritative
session start/end, delivered energy, charging completion versus plugged-in
idling, reservations and queues, maintenance detail, guaranteed real-time
latency, physical connector concurrency, and customer-specific final prices.

## Assumptions still requiring verification

- Object `last_updated` values appear to be local Lithuanian wall-clock times
  because they omit an offset; this is an inference and must not be used as a
  confirmed time-zone rule.
- Exact city matching is a temporary investigation rule, not an authoritative
  Vilnius administrative-boundary test.
