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
