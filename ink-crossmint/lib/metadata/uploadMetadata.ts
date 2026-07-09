export async function uploadMetadata(metadata: unknown) {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(metadata))));
  return `data:application/json;base64,${encoded}`;
}
