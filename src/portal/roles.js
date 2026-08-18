const ROLES = {
  citizen: {
    label: 'Citizen',
    permissions: ['report_incident', 'track_status'],
    dashboard: 'citizen'
  },
  ambulance: {
    label: 'Ambulance',
    permissions: ['view_assignments', 'update_status', 'share_location'],
    dashboard: 'ambulance'
  },
  hospital: {
    label: 'Hospital',
    permissions: ['view_capacity', 'accept_patient', 'update_beds'],
    dashboard: 'hospital'
  },
  dispatcher: {
    label: 'Dispatcher',
    permissions: ['dispatch_ambulance', 'manage_incident', 'view_map'],
    dashboard: 'dispatcher'
  },
  admin: {
    label: 'Admin',
    permissions: ['audit', 'manage_users', 'configure'],
    dashboard: 'admin'
  },
  super_admin: {
    label: 'Super Admin',
    permissions: ['all'],
    dashboard: 'super-admin'
  }
};

module.exports = ROLES;
