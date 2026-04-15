import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { OADSchema, type OADDocument } from '../schema/oad';

export function loadOAD(filePath: string): OADDocument {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const ext = filePath.split('.').pop()?.toLowerCase();
  const data = (ext === 'yaml' || ext === 'yml') ? yaml.load(raw) : JSON.parse(raw);
  return OADSchema.parse(data);
}

export function validateOAD(data: unknown): OADDocument {
  return OADSchema.parse(data);
}
