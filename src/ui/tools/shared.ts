export function readBodyInnerText(documentObject: Document): string {
  return documentObject.body?.innerText ?? '';
}
