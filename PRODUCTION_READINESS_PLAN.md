# GoldenHour EDS — MNC-Grade Production Readiness Plan

## Executive Summary
Transform the current prototype into an enterprise-grade Emergency Dispatch System meeting MNC standards for **security, scalability, observability, resilience, and compliance**.

---

## 1. Database & Data Layer (Priority: CRITICAL)

### Current State
- SQLite only, no migration system, raw SQL strings, no connection pooling for Postgres

### Target State
- **Multi-database support** with proper abstraction (SQLite dev, Postgres prod)
- **Migration system** with versioning, rollback, idempotency
- **Connection pooling** (pg-pool for Postgres, better-sqlite3 for SQLite)
- **Repository pattern** with type-safe queries
- **Soft deletes** + audit triggers
- **Read replicas** support for scaling reads

### Implementation
- [ ] `src/db/pool.js` — Unified pool factory with health checks
- [ ] `src/db/migrations/` — Timestamped migration files with up/down
- [ ] `src/db/schema.sql` — Canonical DDL with constraints, indexes, FKs
- [ ] `src/repositories/` — Incident, Ambulance, Hospital, Audit repositories
- [ ] `scripts/migrate.js` — CLI runner with rollback support

---

## 2. Security Hardening (Priority: CRITICAL)

### Current State
- Hardcoded JWT secret, demo users in memory, basic RBAC, no input validation

### Target State
- **Secrets management** (Vault/SealedSecrets, env-only in prod)
- **Token rotation** (short-lived access + refresh tokens)
- **JWT best practices** (RS256, JWKS endpoint, key rotation)
- **Input validation** (Zod schemas on every endpoint)
- **Rate limiting** per-user + per-IP with Redis backend
- **CSRF protection** for state-changing operations
- **Security headers** (CSP, HSTS, X-Frame-Options, Permissions-Policy)
- **Audit logging** — tamper-evident, structured, searchable
- **Penetration test checklist** — OWASP Top 10 coverage

### Implementation
- [ ] `src/security/` — validators, sanitizers, CSRF, rate-limiter
- [ ] `src/auth/tokens.js` — RS256, JWKS, rotation
- [ ] `src/auth/rbac.js` — Policy-based permissions (CASL-style)
- [ ] `config/secrets.yaml` — SealedSecrets template
- [ ] Remove all hardcoded secrets from codebase

---

## 3. Observability Stack (Priority: HIGH)

### Current State
- Console logging to file, basic health endpoints, no metrics/tracing

### Target State
- **Structured JSON logging** (Pino/Zerolog) with correlation IDs
- **Prometheus metrics** — RED (Rate, Errors, Duration) + USE (Utilization, Saturation, Errors)
- **OpenTelemetry tracing** — distributed traces across services
- **Health checks** — liveness/readiness/startup probes with dependency checks
- **SLO/SLI dashboards** — Grafana with alerting rules
- **Log aggregation** — Loki/ELK integration ready

### Key Metrics
| Category | Metrics |
|----------|---------|
| **API** | `http_requests_total`, `http_request_duration_seconds`, `http_errors_total` |
| **Business** | `incidents_created_total`, `dispatch_decisions_total`, `ambulance_utilization` |
| **System** | `process_cpu_seconds`, `process_memory_bytes`, `db_connections_active` |
| **Queue** | `jobs_queued`, `jobs_processed_duration_seconds`, `jobs_failed_total` |

### Implementation
- [ ] `src/observability/` — logger, metrics, tracing, health
- [ ] `monitoring/prometheus.yml` — scrape config + alerting rules
- [ ] `monitoring/grafana/dashboards/` — GoldenHour dashboards
- [ ] `monitoring/loki-config.yml` — log aggregation
- [ ] `k8s/servicemonitor.yaml` — Prometheus Operator integration

---

## 4. Resilience Patterns (Priority: HIGH)

### Current State
- No circuit breakers, no retries, no bulkheads, synchronous everything

### Target State
- **Circuit breakers** on external calls (OSRM, hospital APIs, Redis)
- **Retry with exponential backoff** + jitter
- **Bulkheads** — isolate critical paths (dispatch vs reporting)
- **Graceful degradation** — cached responses when deps down
- **Idempotency keys** on all mutating endpoints
- **Dead letter queues** for failed background jobs
- **Chaos engineering** — LitmusChaos experiments

### Implementation
- [ ] `src/resilience/` — circuit-breaker, retry, bulkhead, timeout
- [ ] `src/middleware/idempotency.js` — Idempotency-Key header support
- [ ] `src/services/queue.js` — BullMQ/Redis queue with DLQ
- [ ] `chaos/` — LitmusChaos experiments

---

## 5. API Quality & Contracts (Priority: HIGH)

### Current State
- Ad-hoc routes, no OpenAPI spec, no request validation, no versioning

### Target State
- **OpenAPI 3.1 spec** — generated from code (tsoa or manual)
- **Request/Response validation** — Zod schemas
- **API versioning** — URL prefix (`/api/v1/`) + header negotiation
- **Problem Details** (RFC 7807) error responses
- **Pagination/filtering** standards
- **Webhook signatures** for hospital callbacks
- **API documentation portal** — Scalar/Redoc

### Implementation
- [ ] `src/api/openapi.yaml` — Complete spec
- [ ] `src/api/validators/` — Zod schemas per endpoint
- [ ] `src/api/versioning.js` — Version negotiation middleware
- [ ] `src/api/errors.js` — RFC 7807 problem details

---

## 6. Testing Strategy (Priority: HIGH)

### Current State
- 17 basic unit/integration tests, no contract, load, or chaos tests

### Target State
| Layer | Tool | Coverage Target |
|-------|------|-----------------|
| **Unit** | Vitest | 90%+ branches |
| **Integration** | Vitest + Testcontainers | All API routes |
| **Contract** | Pact | Consumer-driven contracts |
| **Load** | k6 | 1000 RPS, p99 < 200ms |
| **Chaos** | LitmusChaos | Dependency failure scenarios |
| **E2E** | Playwright | Critical user journeys |
| **Security** | OWASP ZAP | CI-integrated scans |

### Implementation
- [ ] Migrate to **Vitest** (faster, better DX)
- [ ] `tests/contract/` — Pact tests
- [ ] `tests/load/` — k6 scenarios
- [ ] `tests/e2e/` — Playwright specs
- [ ] `tests/security/` — ZAP baseline
- [ ] GitHub Actions matrix for all test types

---

## 7. Infrastructure & Kubernetes (Priority: HIGH)

### Current State
- Basic Deployment, Service, HPA, ConfigMap, Secret (plaintext!)

### Target State
- **Namespace isolation** + NetworkPolicies
- **PodDisruptionBudget** for HA
- **Init containers** for migrations
- **Sidecar** for logging/metrics (otel-collector)
- **SealedSecrets** / ExternalSecrets Operator
- **Ingress** with TLS, WAF, rate limiting
- **ServiceMesh** ready (Istio/Linkerd) — mTLS, traffic splitting
- **Multi-region** — Active/Passive with ArgoCD

### Implementation
- [ ] `k8s/base/` — Kustomize base with all resources
- [ ] `k8s/overlays/{dev,staging,prod}/` — Environment configs
- [ ] `k8s/networkpolicy.yaml` — Zero-trust network
- [ ] `k8s/pdb.yaml` — PodDisruptionBudget
- [ ] `k8s/ingress.yaml` — TLS, annotations
- [ ] `argocd/` — Application manifests

---

## 8. CI/CD Pipeline (Priority: HIGH)

### Current State
- Single workflow: lint + test + deploy pages

### Target State
**Pipeline Stages:**
1. **PR Validation** — lint, typecheck, unit, contract, security scan
2. **Build** — multi-arch Docker (amd64/arm64), SBOM (Syft), sign (Cosign)
3. **Staging Deploy** — ArgoCD sync to staging, run integration + load tests
4. **Canary** — 10% traffic, automated rollback on SLO breach
5. **Production** — Blue/Green or Progressive delivery
6. **Post-Deploy** — Smoke tests, synthetic monitoring

### Implementation
- [ ] `.github/workflows/ci.yml` — Matrix jobs, caching, artifact upload
- [ ] `.github/workflows/cd.yml` — Environment promotion gates
- [ ] `.github/workflows/security.yml` — Trivy, Grype, OWASP ZAP, dependency review
- [ ] `.github/workflows/chaos.yml` — Scheduled chaos experiments
- [ ] `Dockerfile` — Multi-stage, distroless, non-root, SBOM labels

---

## 9. Developer Experience (Priority: MEDIUM)

### Target State
- **Dev Containers** — VS Code devcontainer with all tools
- **Local Kubernetes** — kind/klusterctl with Tilt for hot reload
- **Makefile** — Common commands (test, build, deploy, logs)
- **Pre-commit hooks** — Husky + lint-staged
- **API Client SDK** — Auto-generated TypeScript/Go/Python clients
- **Feature Flags** — LaunchDarkly/Unleash integration

### Implementation
- [ ] `.devcontainer/` — Dev container config
- [ ] `Makefile` — Standard targets
- [ ] `.husky/pre-commit` — Lint-staged config
- [ ] `tilt.yaml` — Local dev loop
- [ ] `sdk/` — Generated clients

---

## 10. Compliance & Operations (Priority: MEDIUM)

### Target State
- **Data retention policies** — Automated cleanup jobs
- **Encryption** — At rest (LUKS/PVC encryption), in transit (mTLS)
- **Backup/Restore** — Velero for k8s, pgBackRest for Postgres
- **Runbooks** — Incident response for each critical path
- **ADR log** — Architecture Decision Records
- **On-call rotation** — PagerDuty/Opsgenie integration
- **Capacity planning** — Automated forecasting

### Implementation
- [ ] `ops/runbooks/` — Markdown runbooks per service
- [ ] `ops/adr/` — Architecture Decision Records
- [ ] `scripts/backup.sh` — Velero + pgBackRest scripts
- [ ] `scripts/retention.js` — Data lifecycle jobs

---

## Implementation Phases

| Phase | Focus | Duration | Deliverable |
|-------|-------|----------|-------------|
| **0** | Foundation | 1 week | Plan approval, repo structure, tooling |
| **1** | Data & Security | 2 weeks | Migrations, auth, validation, secrets |
| **2** | Observability | 1 week | Logging, metrics, tracing, dashboards |
| **3** | Resilience | 1 week | Circuit breakers, retries, queues, idempotency |
| **4** | API Contracts | 1 week | OpenAPI, versioning, validation, docs |
| **5** | Testing | 1 week | Full test pyramid, CI integration |
| **6** | Infrastructure | 1 week | Production k8s, GitOps, networking |
| **7** | CI/CD | 1 week | Multi-stage pipeline, security gates |
| **8** | DX & Compliance | 1 week | Dev containers, runbooks, ADRs |

**Total: ~10 weeks for full MNC-grade transformation**

---

## Quick Wins (Can Start Immediately)

1. **Replace console.log with Pino** — 2 hours
2. **Add Zod validation to all endpoints** — 4 hours
3. **Generate OpenAPI spec from existing routes** — 3 hours
4. **Add Prometheus metrics endpoint** — 2 hours
5. **Fix Kubernetes secrets (use SealedSecrets)** — 1 hour
6. **Add health check dependency verification** — 2 hours
7. **Implement idempotency keys** — 3 hours
8. **Migrate tests to Vitest** — 4 hours

---

## Success Criteria

| Metric | Target |
|--------|--------|
| **Availability** | 99.9% (43 min downtime/month) |
| **Latency (p99)** | < 200ms API, < 500ms dispatch decision |
| **Error Rate** | < 0.1% |
| **Deploy Frequency** | Daily to staging, weekly to prod |
| **Lead Time** | < 1 hour (commit → prod) |
| **MTTR** | < 15 minutes |
| **Test Coverage** | > 90% branches |
| **Security Scan** | 0 Critical/High vulns in CI |
| **SLO Compliance** | > 99.9% of 30-day windows |

---

## Next Steps

1. **Review & approve** this plan
2. **Prioritize phases** based on business needs
3. **Assign ownership** per workstream
4. **Set up project board** with milestones
5. **Begin Phase 0** — Foundation tooling

---

*Document Version: 1.0*  
*Created: 2026-08-19*  
*Owner: Platform Engineering*