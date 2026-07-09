#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { SuiGraphQLClient } from "@mysten/sui/graphql";

const envPath = path.join(process.cwd(), ".env.local");

function parseEnvFile(filePath) {
  const env = {};
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    env[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }

  return { ...env, ...process.env };
}

const env = parseEnvFile(envPath);
const graphqlUrl = env.SUI_GRAPHQL_URL || env.NEXT_PUBLIC_SUI_GRAPHQL_URL;

if (!graphqlUrl) {
  console.error("SUI_GRAPHQL_URL or NEXT_PUBLIC_SUI_GRAPHQL_URL is not set.");
  process.exit(1);
}

const client = new SuiGraphQLClient({
  url: graphqlUrl,
  network: env.NEXT_PUBLIC_SUI_NETWORK || "testnet",
});

try {
  const result = await client.query({
    query: `
      query SuiGraphqlHealth {
        serviceConfig {
          enabledFeatures
          maxQueryDepth
          maxQueryNodes
          maxOutputNodes
        }
      }
    `,
    variables: {},
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join("; "));
  }

  console.log(`GraphQL RPC OK: ${graphqlUrl}`);
  console.log(JSON.stringify(result.data?.serviceConfig, null, 2));
} catch (error) {
  console.error(`GraphQL RPC failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
