import {blobStorage} from '../../cloud/storage.mjs';
import {createApplication} from '../../cloud/application.mjs';

export default async function handler(request, context) {
  return createApplication({storage: blobStorage(context), getEnv: name => Netlify.env.get(name), secureCookies: true}).handler(request, {ip: context.ip});
}
export const config = {path: '/api/v1/*'};
