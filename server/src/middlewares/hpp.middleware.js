// Express 5-compatible HPP guard. Collapses duplicated query params to the
// last value (?user=admin&user=hacker -> { user: "hacker" }) so downstream
// code never receives an unexpected array.
function hppSafe(req, res, next) {
  const cleaned = {};
  for (const [key, value] of Object.entries(req.query)) {
    cleaned[key] = Array.isArray(value) ? value[value.length - 1] : value;
  }
  // req.query is getter-only in Express 5, so shadow it on the instance.
  Object.defineProperty(req, "query", {
    value: cleaned,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  next();
}

export default hppSafe;
