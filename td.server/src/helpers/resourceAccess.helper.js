/* eslint-disable max-lines, max-lines-per-function, complexity, no-await-in-loop, require-unicode-regexp, no-mixed-operators, no-continue, prefer-named-capture-group, no-useless-escape, max-depth, no-empty-function, sort-imports, no-bitwise, no-promise-executor-return, require-await, no-console, no-inner-declarations, no-invalid-this, radix, no-new, no-nested-ternary, no-unused-vars, no-eq-null, no-control-regex */
/**
 * Ownership checks for resources that live outside threat_models/org scope
 * but still require user isolation (OSV scans, Jules sessions).
 */

/** @returns {boolean} */
export function canAccessOsvScanRun(scan, user) {
  if (!scan || !user) {return false;}
  if (user.role === 'admin') {return true;}
  const uid = user.id;
  if (uid === undefined || uid === null) {return false;}
  if (scan.created_by == null) {return false;}
  return String(scan.created_by) === String(uid);
}

/** @returns {boolean} */
export function canAccessJulesSession(session, user) {
  if (!session || !user) {return false;}
  if (user.role === 'admin') {return true;}
  const uid = user.id;
  if (uid === undefined || uid === null) {return false;}
  if (session.created_by == null) {return false;}
  return String(session.created_by) === String(uid);
}
