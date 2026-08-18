# 🚀 Deployment Guide

Complete guide for deploying GoldenHour EDS to production environments.

---

## Table of Contents
1. [Local Development](#local-development)
2. [Docker Deployment](#docker-deployment)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [Environment Configuration](#environment-configuration)
5. [Database Migration](#database-migration)
6. [Monitoring & Health Checks](#monitoring--health-checks)
7. [Security Hardening](#security-hardening)
8. [Troubleshooting](#troubleshooting)

---

## Local Development

### Quick Start
```bash
# Install dependencies
npm install

# Copy environment
cp .env.example .env

# Start server (auto-reload with nodemon)
npm run dev

# Or run with npm start
npm start
```

Server: `http://localhost:3000`

### Run Tests
```bash
npm test
```

All 5 integration tests should pass:
```
✔ health endpoint responds successfully
✔ readiness endpoint returns ready status
✔ dashboard endpoint provides dispatch data
✔ incident creation requires auth
✔ incident creation succeeds with valid dispatcher auth
```

---

## Docker Deployment

### Build Image
```bash
docker build -t goldenhour-eds:latest .
```

### Run Container
```bash
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your-production-secret \
  -e ALLOWED_ORIGINS=https://yourdomain.com \
  -e DB_PATH=/data/goldenhour.db \
  -v goldenhour-data:/data \
  goldenhour-eds:latest
```

### Docker Compose (Full Stack)
```bash
docker-compose up --build
```

Includes:
- **app** - Node.js application (port 3000)
- **redis** - Redis cache (port 6379)
- **postgres** - PostgreSQL database (port 5432)

---

## Kubernetes Deployment

### Prerequisites
- Kubernetes 1.20+
- kubectl configured
- Container registry (Docker Hub, ECR, GCR, etc.)

### 1. Build and Push Image
```bash
# Build
docker build -t your-registry/goldenhour-eds:v1.0.0 .

# Push to registry
docker push your-registry/goldenhour-eds:v1.0.0
```

### 2. Create Namespace
```bash
kubectl apply -f k8s/namespace.yaml
```

### 3. Create Secrets
```bash
kubectl create secret generic goldenhour-secrets \
  --from-literal=JWT_SECRET=your-secret-key \
  --from-literal=API_SECRET=your-api-secret \
  -n goldenhour
```

### 4. Update Deployment Image
Edit `k8s/deployment.yaml` and update the image:
```yaml
image: your-registry/goldenhour-eds:v1.0.0
```

### 5. Deploy
```bash
# Apply all manifests
kubectl apply -f k8s/

# Verify deployment
kubectl get pods -n goldenhour
kubectl get svc -n goldenhour
kubectl get ingress -n goldenhour
```

### 6. Check Rollout Status
```bash
kubectl rollout status deployment/goldenhour-app -n goldenhour
```

### 7. Access Application
```bash
# Port forward
kubectl port-forward -n goldenhour svc/goldenhour-service 3000:80

# Or use ingress URL (if configured)
# https://youringress.domain
```

### Scale Manually
```bash
kubectl scale deployment goldenhour-app --replicas=5 -n goldenhour
```

### View Logs
```bash
# Latest logs
kubectl logs -n goldenhour deployment/goldenhour-app

# Follow logs
kubectl logs -f -n goldenhour deployment/goldenhour-app

# View logs from specific pod
kubectl logs -n goldenhour goldenhour-app-xxxxx
```

### Update Image
```bash
# Set new image
kubectl set image deployment/goldenhour-app \
  goldenhour-app=your-registry/goldenhour-eds:v1.0.1 \
  -n goldenhour

# Watch rollout
kubectl rollout status deployment/goldenhour-app -n goldenhour
```

---

## Environment Configuration

### Required Variables
```bash
NODE_ENV=production                          # production/development
PORT=3000                                    # Server port
JWT_SECRET=your-secret-key-change-this      # JWT signing key
API_SECRET=your-api-secret-change-this      # API secret
```

### Optional Variables
```bash
ALLOWED_ORIGINS=https://yourdomain.com      # CORS whitelist (comma-separated)
DB_PATH=./data/goldenhour.db                # Database path
MAP_CENTER_LAT=26.9124                       # Default map latitude
MAP_CENTER_LNG=75.7873                       # Default map longitude
LOG_LEVEL=info                               # Logging level
REDIS_URL=redis://localhost:6379            # Redis connection
```

### Secure Configuration
Never commit secrets to version control:
```bash
# .gitignore
.env
.env.production
secrets/
keys/
```

---

## Database Migration

### SQLite (Development)
```bash
# Initialize database
npm run migrate

# Verify seed data
npm run seed
```

### PostgreSQL (Production)

#### 1. Create Database
```bash
createdb goldenhour_production
```

#### 2. Update Connection String
```bash
# .env.production
DB_URL=postgresql://user:password@localhost:5432/goldenhour_production
```

#### 3. Verify Connection
```bash
psql -U user -d goldenhour_production -c "SELECT COUNT(*) FROM incidents;"
```

---

## Monitoring & Health Checks

### Health Endpoint
```bash
curl http://localhost:3000/api/health
```

### Readiness Probe
```bash
curl http://localhost:3000/api/ready
```

---

## Security Hardening

- ✅ CORS whitelist configured
- ✅ Content Security Policy enabled
- ✅ XSS protection via sanitization
- ✅ Rate limiting: 120 req/min
- ✅ Input validation on all endpoints
- ✅ Helmet security headers
- ✅ JWT authentication (8h expiration)
- ✅ Role-based access control

---

## Troubleshooting

### Application Won't Start

**Error: Cannot find module 'express'**
```bash
npm install
```

**Error: Port 3000 already in use**
```bash
lsof -i :3000
kill -9 <PID>
```

**Error: Database connection failed**
```bash
npm run migrate
npm run seed
```

### API Endpoints Not Responding

**Check server is running**
```bash
curl http://localhost:3000/api/health
```

**Check logs**
```bash
tail -f logs/app.log
```

---

**Need help?** Refer to main [README](../README.md).
