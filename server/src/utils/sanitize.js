import xss from "xss";

// Clean one string value (use in controllers before DB save/response).
function clean(value) {
  if (typeof value !== "string") return value;
  return xss(value);
}

// Recursively clean all strings in an object/array (for req bodies).
function cleanObject(input) {
  if (typeof input === "string") return clean(input);
  if (Array.isArray(input)) return input.map(cleanObject);
  if (input && typeof input === "object") {
    const out = {};
    for (const [key, val] of Object.entries(input)) out[key] = cleanObject(val);
    return out;
  }
  return input;
}

export { clean, cleanObject };
