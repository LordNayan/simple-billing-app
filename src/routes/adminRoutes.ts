import { emptyKVStore } from "../utils/kvStore";
import { createSuccessResponse } from "../utils/responses";

export async function handleEmptyKV(): Promise<Response> {
  await emptyKVStore(BILLING_KV);
  return createSuccessResponse("KV store emptied successfully", 200);
}
