import Ajv from 'ajv/dist/2020.js';
import contract from '../contracts/openapi.json' with {type: 'json'};
import {AppError} from './common.mjs';

const ajv = new Ajv({strict: false, useDefaults: true, validateFormats: false});
ajv.addSchema({...contract, $id: 'wanderwise'});
const routes = [];
for (const [path, methods] of Object.entries(contract.paths)) {
  for (const [method, spec] of Object.entries(methods)) {
    const schema = spec.requestBody?.content?.['application/json']?.schema;
    const ref = schema?.$ref;
    routes.push({pattern: new RegExp('^' + path.replace(/\{[^}]+\}/g, '[^/]+') + '$'), method: method.toUpperCase(),
      validate: schema ? ajv.compile(ref ? {$ref: 'wanderwise' + ref} : schema) : null});
  }
}
export function validateBody(method, path, body) {
  const route = routes.find(r => r.method === method && r.pattern.test(path));
  if (!route) throw new AppError('NOT_FOUND', '此接口不存在。', 404);
  if (route.validate && !route.validate(body)) throw new AppError('VALIDATION_ERROR', '输入不符合要求，请检查长度、格式和必填项。', 422);
  return body;
}
