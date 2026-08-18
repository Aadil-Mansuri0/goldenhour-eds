# 🚑 GoldenHour EDS - Emergency Dispatch System

> **Enterprise-Grade Emergency Response Management Platform**
>
> A complete, production-ready emergency dispatch system built with modern web technologies, featuring real-time operations, multi-role dashboards, AI-powered routing, and enterprise-grade security.

![Status](https://img.shields.io/badge/status-production--ready-green?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Node](https://img.shields.io/badge/node-v18%2B-brightgreen?style=flat-square)

## ✨ Features

### 🎯 Core Capabilities
- **Multi-Role Portal System**: 6 distinct user roles with role-based access control
- **Real-Time Operations Dashboard**: Live incident tracking and dispatch management
- **AI-Powered Routing**: Intelligent ambulance-to-hospital matching with demand forecasting
- **Hospital Integration**: Bed capacity management and patient intake coordination
- **Citizen Emergency Reporting**: Public-facing emergency request interface
- **Fleet Management**: Real-time ambulance tracking with GPS and status monitoring

### 🔐 Security & Compliance
- **JWT Authentication**: Secure token-based sessions with 8-hour expiration
- **Role-Based Access Control (RBAC)**: 6 granular permission levels
- **Content Security Policy**: Protection against XSS and injection attacks
- **CORS Protection**: Configurable origin-based access control
- **Bcrypt Password Hashing**: Industry-standard password encryption
- **Input Validation**: Comprehensive payload validation on all endpoints
- **Rate Limiting**: 120 requests/minute default with endpoint-specific overrides

### ⚙️ Enterprise Architecture
- **Microservices Pattern**: 7 independent service modules
- **Real-Time WebSocket**: Live updates and instant notifications
- **Redis Caching**: Distributed cache with graceful fallback
- **Background Workers**: Asynchronous job queue system
- **Database Abstraction**: SQLite development → PostgreSQL production ready
- **Structured Logging**: JSON-formatted logs with audit trail
- **Health Monitoring**: Ready/live probes for Kubernetes

### 📊 Analytics & Insights
- **AI Dispatch Readiness Scoring**: 0-99 scale incident prioritization
- **Demand Forecasting**: Regional demand prediction by time of day
- **Performance Metrics**: Response time, fleet utilization, compliance tracking
- **Audit Logging**: Complete activity trail for regulatory compliance

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Git**: For version control

### Installation

```bash
# Clone repository
git clone https://github.com/Aadil-Mansuri0/goldenhour-eds.git
cd goldenhour-eds

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm start
```

Server runs on `http://localhost:3000/`

---

## 📋 Demo Credentials

Login at `http://localhost:3000/` with any of these roles:

| Role | Username | Password | Portal |
|------|----------|----------|--------|
| 🚨 **Dispatcher** | `dispatcher` | `goldenhour@123` | Command Center |
| ⚙️ **Admin** | `admin` | `admin@golden` | Analytics & Audit |
| 🏥 **Hospital** | `hospital` | `hospital@2026` | Bed Management |
| 🚑 **Ambulance** | `ambulance` | `ambulance@123` | Fleet Tracking |
| 👤 **Citizen** | `citizen` | `citizen@123` | Emergency Reporting |
| 👑 **Super Admin** | `superadmin` | `superadmin@123` | System Governance |

---

## 📁 Project Structure

```
goldenhour-eds/
├── public/                          # Frontend applications
│   ├── login.html                   # Multi-role authentication portal
│   ├── dispatcher-portal.html        # Command center with live map
│   ├── hospital-portal.html          # Bed capacity management
│   ├── ambulance-portal.html         # Fleet GPS tracking
│   ├── admin-portal.html             # Analytics & user management
│   ├── citizen-portal.html           # Emergency intake form
│   ├── superadmin-portal.html        # Regional oversight
│   ├── app.js                        # Shared frontend utilities
│   └── styles.css                    # Global styling
│
├── src/
│   ├── server.js                     # Express API server (main entry)
│   ├── auth.js                       # JWT + RBAC implementation (6 roles)
│   ├── database.js                   # SQLite schema with indexes
│   ├── config.js                     # Environment configuration
│   ├── logger.js                     # Structured JSON logging
│   │
│   ├── services/
│   │   ├── dispatchService.js        # Hospital matching, ETA calculation
│   │   ├── aiService.js              # Readiness scoring, demand forecast
│   │   ├── routingService.js         # Multi-provider routing abstraction
│   │   ├── redisService.js           # Distributed caching layer
│   │   ├── cacheService.js           # In-memory TTL cache
│   │   ├── websocketService.js       # Real-time broadcast integration
│   │   └── workerService.js          # Background job queue
│   │
│   ├── middleware/
│   │   └── errorHandler.js           # Centralized error handling
│   │
│   └── portal/
│       └── roles.js                  # Role definitions & permissions
│
├── tests/
│   └── api.test.js                   # Integration test suite
│
├── scripts/
│   ├── migrate.js                    # Database initialization
│   └── seed.js                       # Demo data verification
│
├── k8s/                              # Kubernetes manifests
│   ├── namespace.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   └── hpa.yaml
│
├── .github/
│   └── workflows/
│       └── ci.yml                    # GitHub Actions CI/CD pipeline
│
├── Dockerfile                        # Production container image
├── docker-compose.yml                # Local development stack
├── package.json                      # Dependencies & scripts
├── .env.example                      # Environment template
└── docs/                             # Comprehensive documentation
```

---

## 🔌 API Endpoints

### Authentication
- `POST /api/login` - User authentication with JWT token

### Data Access
- `GET /api/health` - Health check with metrics
- `GET /api/ready` - Kubernetes readiness probe
- `GET /api/verify-token` - Token validation and role verification
- `GET /api/dashboard` - Complete dashboard data (cached)
- `GET /api/incidents` - List all incidents
- `GET /api/ambulances` - List all ambulances
- `GET /api/hospitals` - List all hospitals

### Operations
- `POST /api/incidents` - Create new incident (requires dispatcher/admin)
- `POST /api/dispatch` - Dispatch ambulance to hospital (requires dispatcher/admin)

See [full API documentation](./docs/api.md)

---

## 🛠️ Development

### Run Tests
```bash
npm test
```

Expected output:
```
✔ health endpoint responds successfully
✔ readiness endpoint returns ready status
✔ dashboard endpoint provides dispatch data
✔ incident creation requires auth
✔ incident creation succeeds with valid dispatcher auth

ℹ tests 5 | pass 5 | fail 0
```

### Run Development Server with Auto-Reload
```bash
npm run dev
```

### Linting
```bash
npm run lint
```

### Database Management
```bash
# Initialize/migrate database
npm run migrate

# Verify seed data
npm run seed
```

---

## 🐳 Docker Deployment

### Local Development with Docker Compose
```bash
docker-compose up --build
```

Includes:
- Node.js application (port 3000)
- Redis cache (port 6379)
- PostgreSQL database (port 5432)

### Production Container Build
```bash
docker build -t goldenhour-eds:latest .
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your-secret \
  goldenhour-eds:latest
```

---

## ☸️ Kubernetes Deployment

### Prerequisites
- Kubernetes cluster (1.20+)
- kubectl configured
- Container registry access

### Deploy
```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Deploy all resources
kubectl apply -f k8s/

# Verify deployment
kubectl get pods -n goldenhour
```

### Horizontal Auto-Scaling
Automatically scales between 2-6 pods based on CPU utilization.

---

## 🔐 Security Features ✅

### Fixed in Latest Release
- ✅ **CORS Protection**: Origin whitelist validation (not open to all)
- ✅ **Content Security Policy**: Enabled with proper directives
- ✅ **XSS Prevention**: All user data sanitized with textContent (not innerHTML)
- ✅ **Complete Authentication**: All 6 demo users now defined and working
- ✅ **WebSocket Integration**: Real-time broadcast connected and functional
- ✅ **Redis Service**: Initialization and connection working
- ✅ **Backend Role Verification**: /api/verify-token endpoint added
- ✅ **Database Indexes**: Performance optimization on status, region columns

### Standard Features
- JWT token-based authentication
- Role-based access control (6 roles)
- Session management with 8-hour expiration
- Bcrypt password hashing (10 salt rounds)
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- Rate limiting (120 req/min per IP)
- Helmet security headers

---

## 📊 Database Schema

### incidents
- id (TEXT, PRIMARY KEY)
- title, type, severity, status, location
- latitude, longitude, region
- patient_count, eta_minutes
- created_at, updated_at

### ambulances
- id (TEXT, PRIMARY KEY)
- vehicle_number, type (ALS/BLS)
- status (available/en-route/dispatched)
- latitude, longitude, region
- battery (0-100), crew_count
- last_updated

### hospitals
- id (TEXT, PRIMARY KEY)
- name, type (public/private)
- latitude, longitude, region
- capacity, available_beds
- trauma_level, specialty

**Indexes**: status, region, created_at

---

## 🚀 What's New (Latest Release)

### Critical Security Fixes ✅
1. **CORS Hardened** - Only allows configured origins
2. **CSP Enabled** - Protection against XSS attacks
3. **XSS Fixed** - All portals use textContent for user data
4. **Auth Complete** - All 6 roles now authenticated
5. **WebSocket Live** - Real-time dispatch updates
6. **Redis Ready** - Caching service initialized
7. **Role Verification** - Backend endpoint validates permissions
8. **DB Optimized** - Indexes on key columns

### New Endpoints
- `GET /api/verify-token` - Verify user role on server
- WebSocket events for real-time dispatch updates

### Environment Updates
- `ALLOWED_ORIGINS` - Configure trusted domains
- `JWT_SECRET` - Customizable signing key
- All 6 demo password overrides via env vars

---

## 📈 Performance

- **Cache Strategy**: 30s TTL for dashboard, Redis distributed cache
- **Query Optimization**: Database indexes, parameterized queries
- **Asset Optimization**: Minified CSS/JS, lazy loading
- **Monitoring**: Health endpoints, structured logging

---

## 🔄 CI/CD Pipeline

GitHub Actions automatically:
1. ✅ Runs test suite on every push
2. ✅ Lints code with ESLint
3. ✅ Builds Docker image
4. ✅ Pushes to registry (if configured)

---

## 📖 Documentation

- [API Reference](./docs/api.md)
- [Deployment Guide](./docs/deployment.md)
- [Architecture](./docs/architecture.md)
- [Database Schema](./docs/er-diagram.md)
- [Portal Guide](./docs/portal-guide.md)

---

## 📋 Production Readiness Checklist

- ✅ Security hardened (CORS, CSP, XSS, auth)
- ✅ All 6 roles working end-to-end
- ✅ Real-time WebSocket integrated
- ✅ Redis caching enabled
- ✅ Database indexes added
- ✅ Role verification on backend
- ✅ Structured logging
- ✅ Health/ready probes
- ✅ Docker containerization
- ✅ Kubernetes manifests
- ✅ CI/CD pipeline
- ✅ Comprehensive documentation
- ✅ Integration tests (5/5 passing)

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT License - See LICENSE file for details

---

**Ready to get started?**

```bash
npm install && npm start
# Visit http://localhost:3000/
```

**For production deployment**, see [Deployment Guide](./docs/deployment.md).
