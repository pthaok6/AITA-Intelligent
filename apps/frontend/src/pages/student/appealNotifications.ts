type AppealNotice = {
  id: string;
  status: string;
  updatedAt?: string;
};

const storageKey = (userId: string) => `aita:appeals:seen:${userId}`;
const inboxStorageKey = (userId: string) => `aita:appeals:inbox-seen:${userId}`;
const signature = (appeal: AppealNotice) => `${appeal.id}:${appeal.status}:${appeal.updatedAt || ''}`;

function readSeen(key: string): Set<string> {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(value) ? value.filter(item => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

export function getUnreadAppealCount(appeals: AppealNotice[], userId: string): number {
  const seen = readSeen(userId);
  return appeals.filter(appeal => appeal.status !== 'SUBMITTED' && !seen.has(signature(appeal))).length;
}

export function markAppealsAsSeen(appeals: AppealNotice[], userId: string): void {
  const seen = readSeen(storageKey(userId));
  appeals.filter(appeal => appeal.status !== 'SUBMITTED').forEach(appeal => seen.add(signature(appeal)));
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...seen].slice(-500)));
  } catch {
    // Keep the appeals page usable when browser storage is unavailable.
  }
}

export function getUnreadAppealInboxCount(appeals: AppealNotice[], userId: string): number {
  const seen = readSeen(inboxStorageKey(userId));
  return appeals.filter(appeal => appeal.status === 'SUBMITTED' && !seen.has(signature(appeal))).length;
}

export function markAppealInboxAsSeen(appeals: AppealNotice[], userId: string): void {
  const seen = readSeen(inboxStorageKey(userId));
  appeals.filter(appeal => appeal.status === 'SUBMITTED').forEach(appeal => seen.add(signature(appeal)));
  try {
    localStorage.setItem(inboxStorageKey(userId), JSON.stringify([...seen].slice(-500)));
  } catch {
    // Keep the appeals page usable when browser storage is unavailable.
  }
}
