export function isCurrentSearchRequest(requestId: number, latestRequestId: number): boolean {
  return requestId === latestRequestId;
}
