export const PROFILE_TAB_IDS = [
  "reviews",
  "lists",
  "diary",
  "stats",
  "listen-later",
] as const;

export type ProfileTab = (typeof PROFILE_TAB_IDS)[number];

export const DEFAULT_PROFILE_TAB: ProfileTab = "reviews";
export const PROFILE_TAB_QUERY_PARAM = "tab";

export function getProfileTab(value: string | null, isOwnProfile: boolean): ProfileTab {
  if (
    value &&
    PROFILE_TAB_IDS.includes(value as ProfileTab) &&
    (value !== "listen-later" || isOwnProfile)
  ) {
    return value as ProfileTab;
  }

  return DEFAULT_PROFILE_TAB;
}

export function getProfileTabHref(
  pathname: string,
  currentSearchParams: Pick<URLSearchParams, "toString">,
  nextTab: ProfileTab
): string {
  const searchParams = new URLSearchParams(currentSearchParams.toString());

  if (nextTab === DEFAULT_PROFILE_TAB) {
    searchParams.delete(PROFILE_TAB_QUERY_PARAM);
  } else {
    searchParams.set(PROFILE_TAB_QUERY_PARAM, nextTab);
  }

  const serializedSearchParams = searchParams.toString();
  return serializedSearchParams ? `${pathname}?${serializedSearchParams}` : pathname;
}
