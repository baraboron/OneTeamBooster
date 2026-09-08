(function (root) {
  'use strict';
  function scopedRecords(session, members, records) {
    if (session.role !== 'leader') return [];
    const ids = new Set(members.filter(m => m.groupId === session.groupId).map(m => m.id));
    return records.filter(r => ids.has(r.recipientId));
  }
  const api = { scopedRecords };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LeaderDomain = api;
})(globalThis);
