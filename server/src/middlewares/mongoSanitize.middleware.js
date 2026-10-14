// Express 5-compatible NoSQL sanitizer (express-mongo-sanitize v2 crashes on
// Express 5 because req.query is getter-only). Sanitizes body + params only.
function sanitizeValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith("$") || key.includes(".")) continue;
      out[key] = sanitizeValue(val);
    }
    return out;
  }
  return value;
}

function mongoSanitize(req, res, next) {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
}

export default mongoSanitize;
