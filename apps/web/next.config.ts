import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const appDirectory = fileURLToPath(new URL('.', import.meta.url));
const rootEnvPath = resolve(appDirectory, '../../.env');

if (existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

const apiInternalUrl = process.env.API_INTERNAL_URL;

if (apiInternalUrl === undefined || apiInternalUrl.length === 0) {
  throw new Error(
    'API_INTERNAL_URL is required. Set it in the repository root .env file.',
  );
}

const graphqlTarget = `${apiInternalUrl.replace(/\/$/, '')}/graphql`;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/graphql',
        destination: graphqlTarget,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
