import { ApiError } from './errors.js';

// A dependency-free field validator. Enough for this API's shapes; swap for zod
// if the schemas ever outgrow it.

const RULES = {
  required: (value) => (value === undefined || value === null || value === '' ? 'is required' : null),
  string: (value) => (typeof value !== 'string' ? 'must be text' : null),
  email: (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value)) ? null : 'must be a valid email address',
  date: (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? null : 'must be a date (YYYY-MM-DD)'),
  int: (value) => (Number.isInteger(Number(value)) ? null : 'must be a whole number'),
  number: (value) => (Number.isFinite(Number(value)) ? null : 'must be a number'),
  boolean: (value) => (typeof value === 'boolean' ? null : 'must be true or false'),
};

const check = (field, value, rule) => {
  if (typeof rule === 'function') return rule(value);

  const [name, arg] = rule.split(':');
  if (RULES[name]) return RULES[name](value, arg);

  if (name === 'min') {
    const n = Number(arg);
    if (typeof value === 'string' && value.length < n) return `must be at least ${n} characters`;
    if (typeof value === 'number' && value < n) return `must be at least ${n}`;
    return null;
  }
  if (name === 'max') {
    const n = Number(arg);
    if (typeof value === 'string' && value.length > n) return `must be at most ${n} characters`;
    if (typeof value === 'number' && value > n) return `must be at most ${n}`;
    return null;
  }
  if (name === 'in') {
    // Comma-separated, because `|` already separates the rules themselves.
    const allowed = arg.split(',');
    return allowed.includes(String(value)) ? null : `must be one of: ${allowed.join(', ')}`;
  }
  if (name === 'password') {
    const v = String(value);
    if (v.length < 8) return 'must be at least 8 characters';
    if (!/[a-z]/.test(v) || !/[A-Z]/.test(v)) return 'must include an upper and lower case letter';
    if (!/\d/.test(v)) return 'must include a number';
    return null;
  }
  throw new Error(`Unknown validation rule "${rule}"`);
};

/**
 * schema: { field: 'required|string|min:2' } — rules after `required` are
 * skipped for absent optional fields.
 */
export const validate = (schema) => (req, _res, next) => {
  const details = {};

  for (const [field, spec] of Object.entries(schema)) {
    const rules = spec.split('|');
    const value = req.body?.[field];
    const optional = !rules.includes('required');

    if (optional && (value === undefined || value === null || value === '')) continue;

    for (const rule of rules) {
      const message = check(field, value, rule);
      if (message) {
        details[field] = `${field} ${message}`;
        break;
      }
    }
  }

  if (Object.keys(details).length > 0) {
    return next(ApiError.badRequest('Some fields need your attention.', details));
  }
  return next();
};
