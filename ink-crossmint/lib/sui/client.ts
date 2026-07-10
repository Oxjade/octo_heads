import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { suiNetwork, suiRpcUrl } from "@/config/chains";

export const suiClient = new SuiJsonRpcClient({
  url: suiRpcUrl,
  network: suiNetwork,
});
