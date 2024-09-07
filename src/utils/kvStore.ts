export async function emptyKVStore(kvNamespace: KVNamespace): Promise<void> {
  let cursor: string | undefined;

  while (true) {
    const listResult = await kvNamespace.list({ cursor });
    const { keys, list_complete } = listResult;

    for (const key of keys) {
      await kvNamespace.delete(key.name);
    }

    if (list_complete) {
      break;
    }

    // Update the cursor for the next iteration
    cursor = listResult.cursor;
  }
}
