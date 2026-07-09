import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { suiGraphqlUrl, suiNetwork } from "@/config/chains";

export function createSuiGraphqlClient(url = suiGraphqlUrl) {
  if (!url) return undefined;
  return new SuiGraphQLClient({
    url,
    network: suiNetwork === "localnet" ? "testnet" : suiNetwork,
  });
}

export async function getSuiGraphqlServiceConfig(url = suiGraphqlUrl) {
  const client = createSuiGraphqlClient(url);
  if (!client) return undefined;

  const result = await client.query<{
    serviceConfig: {
      enabledFeatures: string[];
      maxQueryDepth: number;
      maxQueryNodes: number;
      maxOutputNodes: number;
    };
  }>({
    query: `
      query SuiServiceConfig {
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

  return result.data?.serviceConfig;
}
