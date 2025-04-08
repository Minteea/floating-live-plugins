import {
  Cookies,
  customFetch,
  requestBuvidCookie,
  ResponseData,
} from "bilibili-live-danmaku";
import {
  fpGet,
  FpInfo,
  generateFakeFpInfo,
  getExClimbWuzhiPayload,
} from "./fingerprint";
import { generateRandomPngBase64 } from "./randomImage";
import { x64hash128 } from "./fp2";
import { generateUuid } from "./uuid";
import { generateLsid } from "./lsid";
import { RoomBaseInfo } from "../types";

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

/** 生成登录二维码 */
export async function qrcodeGenerate(options?: FetchOptions) {
  const res = await customFetch(
    options,
    "https://passport.bilibili.com/x/passport-login/web/qrcode/generate"
  ).then((res) => res.json());
  return {
    url: res.data.url,
    key: res.data.qrcode_key,
  };
}

/** 生成登录二维码 */
export async function requestFingerSpi(
  options?: FetchOptions
): Promise<Record<"b_3" | "b_4", string>> {
  const res = await customFetch(
    options,
    "https://api.bilibili.com/x/frontend/finger/spi"
  ).then((res) => res.json());
  return res.data;
}
/** 检测登录二维码 */
export async function checkLoginQRcode(
  key: string,
  options?: FetchOptions
): Promise<[number, string?]> {
  const res = await customFetch(
    options,
    `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${key}`
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

function wait(t: number) {
  return new Promise((res, rej) => {
    const to = setTimeout(() => {
      res(undefined);
      clearTimeout(t);
    }, t);
  });
}

/** 获取并激活buvid的cookie */
export async function getActivatedBuvidCookie(
  fp: FpInfo | null | undefined,
  options: FetchOptions
) {
  const cookies = new Cookies<
    "buvid3" | "buvid4" | "_uuid" | "buvid_fp" | "b_lsid"
  >();
  cookies.append(
    await requestBuvidCookie({
      ...options,
      cookie: cookies.toString(),
    })
  );

  const { b_4 } = await requestFingerSpi({
    ...options,
    cookie: cookies.toString(),
  });
  cookies.set("buvid4", b_4);

  if (!fp) {
    fp = generateFakeFpInfo({
      canvas: generateRandomPngBase64(),
      webgl: generateRandomPngBase64(),
      userAgent:
        options.userAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0",
      platform: "Win32",
    });
  }
  cookies.append(
    getFingerprintCookie(fp, {
      ...options,
      cookie: cookies.toString(),
    })
  );
  // await wait(2000);
  const payload = getExClimbWuzhiPayload(fp, {
    uuid: cookies.get("_uuid"),
    timestamp: Date.now().toString(),
    browser_resolution: fpGet(fp, "availableScreenResolution").join("x"),
    abtest: `{"b_ut":null,"home_version":"V8","in_new_ab":true,"ab_version":{"for_ai_home_version":"V8","enable_web_push":"DISABLE","ad_style_version":"NEW","enable_feed_channel":"ENABLE","enable_ai_floor_api":"DISABLE"},"ab_split_num":{"for_ai_home_version":54,"enable_web_push":10,"ad_style_version":54,"enable_feed_channel":54,"enable_ai_floor_api":137},"uniq_page_id":"${Math.floor(
      Math.random() * 2000000000000
    )}","is_modern":true}`,
  });

  requestExClimbWuzhi(JSON.stringify(payload), {
    ...options,
    cookie: cookies.toString(),
  });
  const cookieRecord: Record<string, string> = {};
  cookies.forEach((val, k) => {
    cookieRecord[k] = val;
  });
  return cookieRecord as Record<
    "buvid3" | "_uuid" | "buvid_fp" | "b_lsid",
    string
  >;
}

/** 获取指纹相关Cookies */
export function getFingerprintCookie(fp: FpInfo, options: FetchOptions) {
  const cookies = new Cookies<"_uuid" | "buvid_fp" | "b_lsid">(options.cookie);
  let _uuid = cookies.get("_uuid");
  let buvid_fp = cookies.get("buvid_fp");
  let b_lsid = cookies.get("b_lsid");

  if (!_uuid) {
    _uuid = generateUuid();
    cookies.set("_uuid", _uuid);
  }
  if (!buvid_fp) {
    const fpString = fp
      .map((e) => {
        return e.value;
      })
      .join("");
    buvid_fp = x64hash128(fpString, 31);
    cookies.set("buvid_fp", buvid_fp);
  }
  if (!b_lsid) {
    b_lsid = generateLsid();
    cookies.set("b_lsid", b_lsid);
  }
  return {
    _uuid,
    buvid_fp,
    b_lsid,
  };
}

/** 激活buvid */
export function requestExClimbWuzhi(payload: string, options: FetchOptions) {
  customFetch(
    options,
    "https://api.bilibili.com/x/internal/gaia-gateway/ExClimbWuzhi",
    {
      method: "POST",
      body: payload,
      credentials: "include",
      headers: {
        Accept: "*/*",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Content-Type": "application/json;charset=UTF-8",
        Origin: "https://www.bilibili.com",
        priority: "u=1, i",
        Referer: "https://www.bilibili.com/",
        "Sec-Ch-Ua": `"Microsoft Edge";v="135", "Not-A.Brand";v="8", "Chromium";v="135"`,
        "Sec-Ch-Mobile": "?0",
        "Sec-Ch-Platform": `"Windows"`,
        "Sec-Ch-Dest": "empty",
        "Sec-Ch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
      },
    }
  ).then((res) => res.json());
}

export function getRoomBaseInfo(room_id: number, options?: FetchOptions) {
  return customFetch(
    options,
    `https://api.live.bilibili.com/xlive/web-room/v1/index/getRoomBaseInfo?room_ids=${room_id}&req_biz=video`
  )
    .then((res) => res.json())
    .then(
      (
        data: ResponseData.Wrap<{ by_room_ids: Record<string, RoomBaseInfo> }>
      ) => data.data
    )
    .then((data) => {
      for (const k in data.by_room_ids) {
        return data.by_room_ids[k];
      }
    });
}

export interface FetchOptions {
  /** 自定义fetch函数(适用于请求中转等情况) */
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  /** 用户代理字段 */
  userAgent?: string;
  /** cookie字段 */
  cookie?: string;
}
