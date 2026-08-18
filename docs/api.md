# GoldenHour API Documentation

## Authentication

### Login

POST /api/login

Request body:

```json
{
  "username": "dispatcher",
  "password": "goldenhour@123"
}
```

Response:

```json
{
  "success": true,
  "token": "jwt-token",
  "user": {
    "username": "dispatcher",
    "role": "dispatcher"
  }
}
```

## Endpoints

### Health

GET /api/health

### Readiness

GET /api/ready

### Dashboard

GET /api/dashboard

### Incidents

GET /api/incidents

POST /api/incidents

Headers:

```http
Authorization: Bearer <token>
```

### Dispatch

POST /api/dispatch

Headers:

```http
Authorization: Bearer <token>
```

### Ambulances

GET /api/ambulances

### Hospitals

GET /api/hospitals
