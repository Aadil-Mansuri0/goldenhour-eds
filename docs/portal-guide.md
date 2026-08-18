# GoldenHour EDS - Premium UI Guide

## Login Portal

The main entry point is a professional login page at:

```
http://localhost:3000/login.html
```

Or simply:

```
http://localhost:3000/
```

### Demo credentials quick-select

Click any demo role card to auto-fill credentials:

- **Dispatcher**: `dispatcher` / `goldenhour@123`
- **Admin**: `admin` / `admin@golden`
- **Hospital**: `hospital` / `hospital@2026`
- **Ambulance**: `ambulance` / `ambulance@123`
- **Citizen**: `citizen` / `citizen@123`
- **Super Admin**: `superadmin` / `superadmin@123`

---

## Role-Specific Portals

After login, each role routes to its own branded portal:

### 🚨 Dispatcher Command Center
**URL**: `/dispatcher-portal.html`

Live incident queue, map visualization, hospital matching, and fleet status. Made for real-time dispatch decisions.

### 🏥 Hospital Dashboard
**URL**: `/hospital-portal.html`

Bed capacity, trauma level, pending arrivals, and occupancy tracking. Built for hospital operations.

### 🚑 Ambulance Fleet View
**URL**: `/ambulance-portal.html`

Live location map, battery status, current assignments, and crew management. Real-time vehicle tracking.

### ⚙️ Admin Analytics
**URL**: `/admin-portal.html`

System health, user activity, API metrics, and audit logs. For platform operations and compliance.

### 👤 Citizen Emergency Reporting
**URL**: `/citizen-portal.html`

Simple emergency form for public incident reporting. No login required—works as a public emergency intake.

### 👑 Super Admin Console
**URL**: `/superadmin-portal.html`

Regional oversight, system configuration, user management, and enterprise governance.

---

## UI Features

All portals include:

- Professional dark mode with enterprise gradient backgrounds
- Consistent branding and color palette
- Real-time data loading from API
- Responsive design (mobile, tablet, desktop)
- Smooth transitions and hover effects
- Token-based session management
- Logout functionality

---

## Architecture

Portal login flow:

```
1. User visits http://localhost:3000/
2. Redirects to /login.html
3. User selects role and enters credentials
4. API validates via /api/login
5. Token stored in localStorage
6. User routed to role-specific portal
7. Portal loads dashboard data and displays live information
```

---

## Testing the portals locally

Start the app:

```bash
npm start
```

Visit:

```
http://localhost:3000/
```

Click any demo credential card to instantly log in and see the portal experience.
