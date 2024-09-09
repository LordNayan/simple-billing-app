export class KVNamespaceMock implements KVNamespace {
  store: Map<string, string> = new Map();

  // @ts-ignore
  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export default KVNamespaceMock;
