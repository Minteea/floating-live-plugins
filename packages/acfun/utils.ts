export {
  getDid,
  getGiftList,
  getStartPlayInfo,
  userLogin,
  userSignIn,
  visitorLogin,
} from "acfun-live-danmaku/tools";

export function parseCookieString(str: string) {
  const cookie: Record<string, string> = {};
  str.split(";").forEach((item) => {
    if (!item) {
      return;
    }
    const arr = item.split("=");
    const key = arr[0]?.trim();
    const val = arr[1]?.trim();
    cookie[key] = val;
  });
  return cookie;
}
