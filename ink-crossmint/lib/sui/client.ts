import { SuiClient } from "@mysten/sui/client";
import { suiRpcUrl } from "@/config/chains";

export const suiClient = new SuiClient({ url: suiRpcUrl });
