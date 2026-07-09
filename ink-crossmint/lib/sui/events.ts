import { collectionConfig } from "@/config/collection";
import { suiClient } from "./client";

export async function getRecentMintEvents(limit = 8) {
  if (!collectionConfig.packageId) return [];

  const response = await suiClient.queryEvents({
    query: {
      MoveEventType: `${collectionConfig.packageId}::ink_genesis_pass::PaymentAccepted`,
    },
    limit,
    order: "descending",
  });

  return response.data.map((event) => ({
    id: event.id.txDigest,
    timestampMs: event.timestampMs,
    parsedJson: event.parsedJson,
  }));
}
