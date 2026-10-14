// Escape metacharacters so untrusted input matches literally inside RegExp.
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Case-insensitive "contains" pattern from user input. Safe by construction:
// escaped input carries no quantifiers, so no backtracking risk.
function containsPattern(query) {
  return new RegExp(escapeRegExp(query), "i");
}

function safeContains(source, query) {
  return containsPattern(query).test(String(source));
}

export { escapeRegExp, containsPattern, safeContains };
