# Grow EV — System Architecture

Status: Proposed architecture
Version: 0.1

TASK-007 implemented locally: `packages/routing` owns the shared contract and
coordinate/geographic validation. `supabase/functions/routing` provides a small
guest Edge Function and server-only TomTom adapter; the driver details UI makes
explicit requests for its existing shortlist on both platforms. No database or
collector dependency in routing; no new packages. Endpoint/runtime deployment
and live TomTom verification await hotspot connectivity. Limits are per isolate;
distributed quota controls remain a public-deployment prerequisite. The remaining
architecture and routing fallback below describe proposed scope.

## 1. Engineering goals

- Real mobile experience.
- Public browser demo without installation.
- Shared code where practical.
- Smooth, high-quality map interactions.
- Reliable real-time data processing.
- Explainable recommendations.
- Low initial infrastructure cost.
- Clear separation between application and intelligence.

## 2. Technology stack

### Application

- Expo + React Native
- TypeScript (strict mode)
- Expo Router
- React Native Web

### Mapping

- MapLibre React Native for Android/iOS.
- MapLibre GL JS for browsers.
- OpenFreeMap as initial basemap candidate.
- TomTom as traffic-aware routing candidate.
- OpenRouteService as a traffic-free routing fallback.

Map rendering and routing are separate systems.

Provider credentials, coverage, limits and licensing must be verified before production use.

### Backend

- Supabase
- PostgreSQL
- PostGIS
- Supabase Edge Functions
- Scheduled data ingestion

### Intelligence

- TypeScript for deterministic application decisions.
- Python for exploratory analysis, statistics and ML.
- scikit-learn initially if a trained model is justified.
- Advanced models only after baseline evaluation.

### Hosting

- Cloudflare for the public web deployment.
- Supabase for the database and application services.
- Python model training initially runs locally or in an appropriate job environment.

Hosting capabilities and free quotas must be verified in the deployment account.

## 3. Application targets

One primary Expo project.

### Browser

- `/` — public landing page.
- `/app` — driver experience.
- `/ops` — operator/city dashboard.

### Android

- Native Grow EV driver application.

### iOS

- Native driver application later.
- Browser version available initially.

The operator dashboard is web-first.

## 4. Platform separation

Shared:

- Domain models.
- API client.
- Business rules.
- Vehicle preferences.
- Charger cards where compatible.
- Design tokens.
- State management.
- Recommendation presentation.

Platform-specific:

- Native map renderer.
- Browser map renderer.
- Location permissions.
- Native notifications.
- Some gestures and navigation behavior.

Prefer platform-specific files when necessary.

Example:

GrowMap.native.tsx
GrowMap.web.tsx

Do not embed the whole website inside a native WebView.

MapLibre Native may require an Expo development build rather than Expo Go. Verify library and Expo SDK compatibility before implementing the mobile map.

## 5. Logical architecture

External charging sources
        |
        v
Data ingestion / validation
        |
        v
PostgreSQL + PostGIS
        |
        +--> Current network state
        |
        +--> Historical status transitions
        |
        v
Network analysis
        |
        +--> Congestion
        +--> Spare capacity
        +--> Reliability signals
        +--> Historical statistics
        |
        v
Decision engine
        |
        +--> Vehicle compatibility
        +--> Route duration
        +--> Charging time
        +--> Availability
        +--> Price
        |
        v
API
        |
        +--> Driver app
        +--> Browser demo
        +--> Operator dashboard

## 6. Backend boundaries

### Ingestion

Responsible for fetching, validating and normalizing external data.

It must not contain UI logic.

### Network analysis

Responsible for status history, metrics, spatial comparisons and congestion explanations.

### Routing adapter

Responsible for requesting road routes and travel-time estimates.

The routing provider must be replaceable.

### Recommendation engine

Responsible for ranking suitable charging options.

It must not depend on an LLM.

### Application API

Responsible for delivering validated information to clients.

Never expose privileged database credentials.

## 7. Repository structure

growev/
  AGENTS.md
  README.md

  apps/
    driver/
      app/
      components/
      features/
      hooks/

  packages/
    domain/
    intelligence/
    api-client/
    design-tokens/

  services/
    ingestion/
    ml/

  supabase/
    migrations/
    functions/

  docs/
  tasks/
    active/
    completed/

This is the intended structure. Create folders only when needed.

## 8. Important rules

- Keep routing provider logic behind an interface.
- Keep map rendering separate from charger intelligence.
- Validate all external data.
- Preserve source timestamps.
- Track stale or missing information.
- Do not let UI components calculate core intelligence independently.
- Keep sensitive data behind proper authorization.
- Use row-level security where client-accessible tables require it.

## 9. Deployment stages

### Stage A — Local development

- Local application.
- Local tests.
- Supabase development project.
- Verified live data ingestion.

### Stage B — Hackathon demo

- Public HTTPS browser URL.
- QR code for direct access.
- Native Android build if ready.
- Guest demo with no login.
- Cached snapshot fallback.
- Clearly labeled simulated features.

### Stage C — Production

- Production authentication.
- Rate limiting and observability.
- Improved data ingestion reliability.
- Model monitoring.
- Privacy and security review.
- Commercial provider integration where needed.

## 10. Performance goals

- Smooth map interaction.
- Map-native layers instead of thousands of React markers.
- Cache responses where appropriate.
- Request detailed routing only for shortlisted chargers.
- Minimize unnecessary database reads.
- Handle disconnected or slow networks gracefully.

Exact performance targets should be established after initial measurement.
