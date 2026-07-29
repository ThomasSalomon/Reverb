export const HOME_SEARCH_QUERY_PARAM = "q";
export const HOME_SEARCH_MIN_QUERY_LENGTH = 2;

type SearchParamsLike = Pick<URLSearchParams, "get" | "toString">;

export function getSearchQuery(searchParams: SearchParamsLike): string {
  return searchParams.get(HOME_SEARCH_QUERY_PARAM)?.trim() ?? "";
}

export function isHomeSearchMode(query: string): boolean {
  return query.length >= HOME_SEARCH_MIN_QUERY_LENGTH;
}

export function getHomeSearchHref(
  pathname: string,
  currentSearchParams: SearchParamsLike,
  nextQuery: string
): string {
  const searchParams = new URLSearchParams(currentSearchParams.toString());
  const query = nextQuery.trim();

  if (query) {
    searchParams.set(HOME_SEARCH_QUERY_PARAM, query);
  } else {
    searchParams.delete(HOME_SEARCH_QUERY_PARAM);
  }

  const serializedSearchParams = searchParams.toString();
  return serializedSearchParams ? `${pathname}?${serializedSearchParams}` : pathname;
}
