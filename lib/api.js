import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const ENV_PATH = path.join(__dirname, '..', '..', '..', '.env'); // 2 levels above skill folder
const BASE_URL = 'https://api.elest.io';

// Load .env file manually (no external dependency)
function loadEnv() {
  const env = {};
  try {
    if (fs.existsSync(ENV_PATH)) {
      const content = fs.readFileSync(ENV_PATH, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIndex = trimmed.indexOf('=');
          if (eqIndex > 0) {
            const key = trimmed.slice(0, eqIndex).trim();
            let value = trimmed.slice(eqIndex + 1).trim();
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            env[key] = value;
          }
        }
      });
    }
  } catch (e) {
    // Silently fail if .env doesn't exist
  }
  return env;
}

// Get credentials from .env
export function getCredentials() {
  const env = loadEnv();
  return {
    email: env.ELESTIO_EMAIL || null,
    apiToken: env.ELESTIO_API_TOKEN || null
  };
}

// Save credentials to .env file
export function saveCredentials(email, apiToken) {
  let content = '';

  // Read existing .env content
  try {
    if (fs.existsSync(ENV_PATH)) {
      content = fs.readFileSync(ENV_PATH, 'utf-8');
    }
  } catch (e) {
    // Start fresh
  }

  // Parse existing env vars
  const lines = content.split('\n');
  const envVars = {};
  const order = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        envVars[key] = trimmed.slice(eqIndex + 1).trim();
        order.push(key);
      }
    } else if (trimmed.startsWith('#') || trimmed === '') {
      order.push(line); // Preserve comments and blank lines
    }
  });

  // Update or add Elestio credentials
  envVars['ELESTIO_EMAIL'] = email;
  envVars['ELESTIO_API_TOKEN'] = apiToken;

  if (!order.includes('ELESTIO_EMAIL')) order.push('ELESTIO_EMAIL');
  if (!order.includes('ELESTIO_API_TOKEN')) order.push('ELESTIO_API_TOKEN');

  // Rebuild .env content
  const newContent = order.map(item => {
    if (item.startsWith('#') || item === '') return item;
    return `${item}=${envVars[item] || ''}`;
  }).join('\n');

  fs.writeFileSync(ENV_PATH, newContent);
}

// Default configuration (non-sensitive data only)
const DEFAULT_CONFIG = {
  jwt: null,
  jwtExpiry: null,
  defaultProject: null,
  defaults: {
    provider: 'netcup',
    datacenter: 'nbg',
    serverType: 'MEDIUM-2C-4G',
    support: 'level1'
  }
};

// Load config from file (non-sensitive data only)
export function loadConfig() {
  let config = { ...DEFAULT_CONFIG };

  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (e) {
    log('warn', `Failed to load config: ${e.message}`);
  }

  // Add credentials from .env
  const creds = getCredentials();
  config.email = creds.email;
  config.apiToken = creds.apiToken;

  return config;
}

// Save config to file (excludes credentials - those go in .env)
export function saveConfig(config) {
  try {
    // Never save credentials to config.json
    const { email, apiToken, ...safeConfig } = config;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(safeConfig, null, 2));
  } catch (e) {
    log('error', `Failed to save config: ${e.message}`);
    throw e;
  }
}

// Check if JWT is expired
function isJwtExpired(config) {
  if (!config.jwt || !config.jwtExpiry) return true;
  // Add 5 minute buffer before expiry
  return Date.now() > (config.jwtExpiry - 300000);
}

// Authenticate and get new JWT
async function authenticate(email, token) {
  const response = await fetch(`${BASE_URL}/api/auth/checkAPIToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token })
  });

  const data = await response.json();

  if (data.status !== 'OK' || !data.jwt) {
    throw new Error(data.message || 'Authentication failed');
  }

  return {
    jwt: data.jwt,
    // JWT typically valid for 24 hours, set expiry to 23 hours to be safe
    jwtExpiry: Date.now() + (23 * 60 * 60 * 1000)
  };
}

// Get JWT (with auto-refresh)
export async function getJwt() {
  const config = loadConfig();

  if (!config.email || !config.apiToken) {
    throw new Error('Not configured. Run: node cli.js config --email YOUR_EMAIL --token YOUR_TOKEN');
  }

  if (isJwtExpired(config)) {
    log('info', 'JWT expired, refreshing...');
    const auth = await authenticate(config.email, config.apiToken);
    config.jwt = auth.jwt;
    config.jwtExpiry = auth.jwtExpiry;
    saveConfig(config);
    log('success', 'JWT refreshed');
  }

  return config.jwt;
}

// Make authenticated API request
export async function apiRequest(endpoint, method = 'POST', body = {}, retried = false) {
  const jwt = await getJwt();

  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };

  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    options.body = JSON.stringify({ jwt, ...body });
  }

  const url = method === 'GET' && Object.keys(body).length > 0
    ? `${BASE_URL}${endpoint}?${new URLSearchParams({ jwt, ...body })}`
    : `${BASE_URL}${endpoint}`;

  const response = await fetch(url, options);

  // Handle JWT expiry (401 or error in response)
  if (response.status === 401 && !retried) {
    log('warn', 'JWT rejected, re-authenticating...');
    const config = loadConfig();
    config.jwt = null;
    config.jwtExpiry = null;
    saveConfig(config);
    return apiRequest(endpoint, method, body, true);
  }

  const data = await response.json();

  // Check for auth error in response body
  const isAuthError = !retried && (
    (data.status === 'error' && data.message?.toLowerCase().includes('auth')) ||
    (data.code === 'InvalidToken') ||
    (data.message?.toLowerCase().includes('invalid token'))
  );

  if (isAuthError) {
    log('warn', 'Auth error, re-authenticating...');
    const config = loadConfig();
    config.jwt = null;
    config.jwtExpiry = null;
    saveConfig(config);
    return apiRequest(endpoint, method, body, true);
  }

  return data;
}

// Make unauthenticated API request (for getTemplates, getServerSizes)
export async function apiRequestNoAuth(endpoint, method = 'GET') {
  const url = `${BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' }
  });

  return response.json();
}

// Export for direct use
export { BASE_URL, authenticate, ENV_PATH };
