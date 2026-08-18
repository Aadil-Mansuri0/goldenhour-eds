const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'goldenhour-demo-secret';

const DEMO_USERS = {
  dispatcher: {
    username: 'dispatcher',
    passwordHash: bcrypt.hashSync('goldenhour@123', 10),
    name: 'Dispatcher Ops',
    role: 'dispatcher'
  },
  admin: {
    username: 'admin',
    passwordHash: bcrypt.hashSync('admin@golden', 10),
    name: 'Admin Lead',
    role: 'admin'
  },
  hospital: {
    username: 'hospital',
    passwordHash: bcrypt.hashSync('hospital@2026', 10),
    name: 'Hospital Liaison',
    role: 'hospital'
  },
  ambulance: {
    username: 'ambulance',
    passwordHash: bcrypt.hashSync('ambulance@123', 10),
    name: 'Ambulance Fleet',
    role: 'ambulance'
  },
  citizen: {
    username: 'citizen',
    passwordHash: bcrypt.hashSync('citizen@123', 10),
    name: 'Citizen Portal',
    role: 'citizen'
  },
  superadmin: {
    username: 'superadmin',
    passwordHash: bcrypt.hashSync('superadmin@123', 10),
    name: 'Super Admin',
    role: 'super_admin'
  }
};

function verifyPassword(username, password) {
  const user = DEMO_USERS[username];
  if (!user) return null;
  const valid = bcrypt.compareSync(password, user.passwordHash);
  return valid ? { ...user } : null;
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.username,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || (!roles.includes(userRole) && userRole !== 'super_admin')) {
      return res.status(403).json({ success: false, error: 'Forbidden: insufficient role permissions.' });
    }
    next();
  };
}

module.exports = {
  DEMO_USERS,
  verifyPassword,
  signToken,
  requireAuth,
  requireRole,
  JWT_SECRET
};
