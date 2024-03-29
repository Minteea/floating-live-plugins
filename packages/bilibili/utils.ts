import { RoomInfo } from "floating-live";
import { RawInfo } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36 Edg/117.0.2045.36";

/** API-当前登录用户信息 */
const UID_INIT_URL = "https://api.bilibili.com/x/web-interface/nav";
/** API-获取BUVID */
const BUVID_INIT_URL = "https://data.bilibili.com/v/";

const ROOM_INIT_URL =
  "https://api.live.bilibili.com/xlive/web-room/v1/index/getInfoByRoom";

const DANMAKU_SERVER_CONF_URL =
  "https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo";

export function getCookie(headers: Headers) {
  const cookies: string[] = [];
  headers.forEach((val, key) => {
    if (key == "set-cookie") {
      const [c] = val.split(";");
      cookies.push(c);
    }
  });
  const cookie = cookies.join("; ");
  return cookie;
}

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

/** 获取登录用户的uid */
export async function getLoginUid(cookie: string = ""): Promise<number> {
  // cookie若缺少SESSDATA，一定属于未登录状态，uid返回0
  if (!parseCookieString(cookie)["SESSDATA"]) return 0;
  const res = await fetch(UID_INIT_URL, {
    headers: {
      Cookie: cookie,
      "User-Agent": USER_AGENT,
    },
  }).then((res) => res.json());
  if (res.code == 0) {
    return res.data.mid;
  } else {
    // code = -101 => 账号未登录
    return 0;
  }
}

/** 获取buvid */
export async function getBuvid(cookie: string = "") {
  const res = await fetch(BUVID_INIT_URL, {
    headers: {
      Cookie: cookie,
      "User-Agent": USER_AGENT,
    },
  });
  const resCookie = getCookie(res.headers);
  if (!resCookie) return;
  return parseCookieString(resCookie)["buvid2"];
}

/** 获取直播间弹幕token */
export async function getToken(roomId: number, cookie: string = "") {
  return await fetch(`${DANMAKU_SERVER_CONF_URL}?id=${roomId}`, {
    headers: {
      Cookie: cookie,
      "User-Agent": USER_AGENT,
    },
  })
    .then((res) => res.json())
    .then((res) => {
      return res.data?.token;
    });
}

/** 生成登录二维码 */
export async function generateLoginQRcode() {
  const res = await fetch(
    "https://passport.bilibili.com/x/passport-login/web/qrcode/generate",
    {
      headers: {
        "User-Agent": USER_AGENT,
      },
    }
  ).then((res) => res.json());
  return {
    url: res.data.url,
    key: res.data.qrcode_key,
  };
}

/** 检测登录二维码 */
export async function checkLoginQRcode(
  key: string
): Promise<[number, string?]> {
  const res = await fetch(
    `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${key}`,
    {
      headers: {
        "User-Agent": USER_AGENT,
      },
    }
  );
  const { code, message } = (await res.json()).data;
  if (code == 86101) {
    // 未扫码
    return [1];
  } else if (code == 86090) {
    // 等待确认
    return [2];
  } else if (code == 0) {
    const cookie = getCookie(res.headers);
    console.log(cookie);
    return [0, cookie];
  } else if (code == 86038) {
    // 二维码失效
    return [-1];
  } else {
    // 其他错误
    console.log(`${code} ${message}`);
    throw message;
  }
}

/** 获取房间id */
export async function getInfoByRoom(id: number): Promise<RawInfo> {
  return await fetch(ROOM_INIT_URL + `?room_id=${id}`, {
    method: "GET",
  })
    .then((response) => response.json())
    .then((data) => data.data);
}
