import {blobStorage} from '../../cloud/storage.mjs';
import {updateDocument} from '../../cloud/common.mjs';

export default async function handler(request, context) {
  const storage = blobStorage(context); let deleted = 0;
  for (const key of await storage.list('users/')) {
    const record = await storage.read(key);
    if (!record || record.data.deleted || record.data.expiresAt > Date.now()) continue;
    await updateDocument(storage, key, state => {
      if (state && !state.deleted && state.expiresAt <= Date.now()) {deleted++; return {data: {deleted: true, expiresAt: Date.now()}};}
      return {data: state};
    });
  }
  for (const key of await storage.list('guest-rate/')) {
    const record = await storage.read(key);
    if (record?.data.expiresAt < Date.now()) await storage.remove(key);
  }
  return new Response(JSON.stringify({deleted}), {headers: {'Content-Type': 'application/json'}});
}
export const config = {schedule: '@daily'};
