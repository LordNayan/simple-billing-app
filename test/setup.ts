import KVNamespaceMock from "./mocks/KVNamespaceMock";

// @ts-ignore
globalThis.BILLING_KV = new KVNamespaceMock();
