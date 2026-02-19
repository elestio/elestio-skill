import { apiRequestNoAuth } from './api.js';
import { formatTable, colors, truncate } from './utils.js';

// Cache for templates (they don't change often)
let templatesCache = null;
let sizesCache = null;

// Get all templates (400+ software)
export async function getTemplates() {
  if (templatesCache) return templatesCache;

  const response = await apiRequestNoAuth('/api/servers/getTemplates');
  templatesCache = response.instances || [];
  return templatesCache;
}

// Search templates by name or category
export async function searchTemplates(query, category = null) {
  const templates = await getTemplates();
  const q = query?.toLowerCase() || '';

  return templates.filter(t => {
    const matchesQuery = !q ||
      t.title?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q);

    const matchesCategory = !category ||
      t.category?.toLowerCase().includes(category.toLowerCase());

    return matchesQuery && matchesCategory;
  });
}

// Template name aliases for convenience
const TEMPLATE_ALIASES = {
  'cicd': 'CI-CD-Target',
  'ci-cd': 'CI-CD-Target',
  'postgres': 'PostgreSQL',
  'pg': 'PostgreSQL',
  'mysql': 'MySQL',
  'mariadb': 'MariaDB',
  'mongo': 'MongoDB',
  'mongodb': 'MongoDB',
  'elastic': 'Elasticsearch',
  'elasticsearch': 'Elasticsearch',
  'wp': 'Wordpress',
  'wordpress': 'Wordpress',
  'k8s': 'K3S',
  'kubernetes': 'K3S'
};

// Find template by exact name or ID
export async function findTemplate(nameOrId) {
  const templates = await getTemplates();

  // Try by ID first
  const byId = templates.find(t => String(t.id) === String(nameOrId));
  if (byId) return byId;

  // Check aliases
  const aliasedName = TEMPLATE_ALIASES[nameOrId?.toLowerCase()];
  if (aliasedName) {
    const byAlias = templates.find(t =>
      t.title?.toLowerCase() === aliasedName.toLowerCase()
    );
    if (byAlias) return byAlias;
  }

  // Try by exact title (case-insensitive)
  const byTitle = templates.find(t =>
    t.title?.toLowerCase() === nameOrId?.toLowerCase()
  );
  if (byTitle) return byTitle;

  // Try partial match
  const partial = templates.find(t =>
    t.title?.toLowerCase().includes(nameOrId?.toLowerCase())
  );
  return partial;
}

// List templates with formatting
export async function listTemplates(category = null) {
  const templates = category
    ? await searchTemplates(null, category)
    : await getTemplates();

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'title', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'version', label: 'Version' }
  ];

  const data = templates.map(t => ({
    id: t.id,
    title: t.title,
    category: truncate(t.category, 25),
    version: t.version || 'latest'
  }));

  console.log(`\n${colors.bold}Templates (${templates.length})${colors.reset}\n`);
  console.log(formatTable(data, columns));
  console.log('');
}

// Get all server sizes (provider/region/size combos)
export async function getServerSizes() {
  if (sizesCache) return sizesCache;

  const response = await apiRequestNoAuth('/api/servers/getServerSizes');
  sizesCache = response.instances || [];
  return sizesCache;
}

// Filter server sizes
export async function filterSizes(provider = null, country = null, city = null) {
  const sizes = await getServerSizes();

  return sizes.filter(s => {
    const matchesProvider = !provider ||
      s.providerName?.toLowerCase() === provider.toLowerCase();

    const matchesCountry = !country ||
      s.Country?.toLowerCase().includes(country.toLowerCase()) ||
      s.CountryCode?.toLowerCase() === country.toLowerCase();

    const matchesCity = !city ||
      s.City?.toLowerCase().includes(city.toLowerCase());

    return matchesProvider && matchesCountry && matchesCity;
  });
}

// Validate provider/datacenter/serverType combo
export async function validateCombo(provider, datacenter, serverType) {
  const sizes = await getServerSizes();

  const match = sizes.find(s =>
    s.providerName?.toLowerCase() === provider?.toLowerCase() &&
    s.regionID?.toLowerCase() === datacenter?.toLowerCase() &&
    s.title?.toLowerCase() === serverType?.toLowerCase()
  );

  return match;
}

// List server sizes with formatting
export async function listSizes(provider = null, country = null) {
  const sizes = await filterSizes(provider, country);

  // Group by provider for better display
  const byProvider = {};
  sizes.forEach(s => {
    if (!byProvider[s.providerName]) {
      byProvider[s.providerName] = [];
    }
    byProvider[s.providerName].push(s);
  });

  console.log(`\n${colors.bold}Server Sizes (${sizes.length} options)${colors.reset}\n`);

  Object.entries(byProvider).forEach(([providerName, providerSizes]) => {
    console.log(`${colors.cyan}${providerName}${colors.reset}`);

    const columns = [
      { key: 'regionID', label: 'Region' },
      { key: 'location', label: 'Location' },
      { key: 'title', label: 'Size' },
      { key: 'vCPU', label: 'CPU' },
      { key: 'ramGB', label: 'RAM' },
      { key: 'storage', label: 'Storage' },
      { key: 'price', label: 'Price/mo' }
    ];

    const data = providerSizes.slice(0, 20).map(s => ({
      regionID: s.regionID,
      location: `${s.City}, ${s.CountryCode}`,
      title: s.title,
      vCPU: s.vCPU,
      ramGB: s.ramGB + 'GB',
      storage: s.storageSizeGB + 'GB ' + (s.storageType || ''),
      price: '$' + (parseFloat(s.pricePerHour) * 24 * 30).toFixed(0)
    }));

    console.log(formatTable(data, columns));
    if (providerSizes.length > 20) {
      console.log(`  ... and ${providerSizes.length - 20} more`);
    }
    console.log('');
  });
}

// Get categories
export async function getCategories() {
  const templates = await getTemplates();
  const categories = [...new Set(templates.map(t => t.category))].filter(Boolean).sort();
  return categories;
}

// List categories
export async function listCategories() {
  const categories = await getCategories();
  console.log(`\n${colors.bold}Template Categories${colors.reset}\n`);
  categories.forEach(c => console.log(`  ${c}`));
  console.log('');
}
