import { customFetch, FetchOptions } from "acfun-live-danmaku";

export function requestUserInfo(userId: number, options: FetchOptions) {
  return customFetch(
    options,
    `https://live.acfun.cn/rest/pc-direct/user/userInfo?userId=${userId}`
  ).then((response) => response.json());
}
