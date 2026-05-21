import fs from 'node:fs';
import path from 'node:path';
import type { VariablesDocument } from '@shared/types/variables';
import { workspaceManager } from './workspaceManager';

const SEED: VariablesDocument = {
  profiles: [
    { id: 'default', name: 'default' },
    { id: 'staging', name: 'staging' },
  ],
  sharedVariables: {
    default: [
      { key: 'BASE_URL', value: 'https://example.com' },
      { key: 'ORDER_ID', value: '' },
    ],
    staging: [
      { key: 'BASE_URL', value: 'https://staging.example.com' },
      { key: 'ORDER_ID', value: '' },
    ],
  },
  privateVariables: {
    default: [{ key: 'AUTH_TOKEN' }],
    staging: [{ key: 'AUTH_TOKEN' }],
  },
};

function paths() {
  const dir = workspaceManager().activeDir();
  return {
    shared: path.join(dir, 'variables.json'),
    private: path.join(dir, 'variables.private.json'),
  };
}

function read(): VariablesDocument {
  const { shared, private: privPath } = paths();
  try {
    if (fs.existsSync(shared)) {
      const parsed = JSON.parse(fs.readFileSync(shared, 'utf-8')) as VariablesDocument;
      if (fs.existsSync(privPath)) {
        try {
          const priv = JSON.parse(fs.readFileSync(privPath, 'utf-8')) as Record<
            string,
            Record<string, string>
          >;
          for (const [profileId, kvs] of Object.entries(priv)) {
            const list = parsed.privateVariables?.[profileId] || [];
            parsed.privateVariables = parsed.privateVariables || {};
            parsed.privateVariables[profileId] = list.map((entry) => ({
              key: entry.key,
              value: kvs[entry.key] ?? entry.value,
            }));
          }
        } catch {
          /* ignore corrupt private file */
        }
      }
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return structuredClone(SEED);
}

function write(doc: VariablesDocument) {
  const { shared, private: privPath } = paths();
  const shareable: VariablesDocument = {
    profiles: doc.profiles,
    sharedVariables: doc.sharedVariables,
    privateVariables: Object.fromEntries(
      Object.entries(doc.privateVariables || {}).map(([k, list]) => [
        k,
        list.map((entry) => ({ key: entry.key })),
      ]),
    ),
  };
  const privateOnly: Record<string, Record<string, string>> = {};
  for (const [profileId, list] of Object.entries(doc.privateVariables || {})) {
    privateOnly[profileId] = {};
    for (const entry of list) {
      if (entry.value !== undefined) privateOnly[profileId][entry.key] = entry.value;
    }
  }
  try {
    fs.writeFileSync(shared, JSON.stringify(shareable, null, 2), 'utf-8');
    fs.writeFileSync(privPath, JSON.stringify(privateOnly, null, 2), 'utf-8');
  } catch {
    /* noop */
  }
}

export const variablesService = {
  load(): VariablesDocument {
    return read();
  },
  save(next: VariablesDocument): VariablesDocument {
    write(next);
    return next;
  },
};
