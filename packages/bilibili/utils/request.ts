import {
  assertRequestOk,
  BilibiliApiClient,
  unwrapRequestData,
} from "bilibili-live-danmaku";
import { parseGetInfoByRoom, parseRoomBaseInfo } from "../parser";
import { getCorrespondPath } from "./crypto";

export interface DataXpassportQrcodeGenerate {
  url: string;
  qrcode_key: string;
}
export interface DataXpassportQrcodePoll {
  url: string;
  refresh_token: string;

  /** 登录时间 */
  timestamp: number;

  /** 扫码状态
   * > 0：扫码登录成功
   * > 86038：二维码已失效
   * > 86090：二维码已扫码未确认
   * > 86101：未扫码
   */
  code: number;

  /** 扫码状态信息 */
  message: string;
}

export interface DataXapiNav {
  isLogin: boolean;
  email_verified: number;
  face: string;
  face_nft: number;
  face_nft_type: number;
  level_info: {
    current_level: number;
    current_min: number;
    current_exp: number;
    next_exp: string;
  };
  mid: number;
  mobile_verified: number;
  money: number;
  moral: number;
  official: { role: number; title: string; desc: string; type: number };
  officialVerify: { type: number; desc: string };
  pendant: {
    pid: number;
    name: string;
    image: string;
    expire: number;
    image_enhance: string;
    image_enhance_frame: string;
    n_pid: number;
  };
  scores: number;
  uname: string;
  vipDueDate: number;
  vipStatus: number;
  vipType: number;
  vip_pay_type: number;
  vip_theme_type: number;
  vip_label: {
    path: string;
    text: number;
    label_theme: string;
    text_color: string;
    bg_style: number;
    bg_color: string;
    border_color: string;
    use_img_label: boolean;
    img_label_uri_hans: string;
    img_label_uri_hant: string;
    img_label_uri_hans_static: string;
    img_label_uri_hant_static: string;
    label_id: number;
    label_goto: {
      mobile: string;
      pc_web: string;
    };
  };
  vip_avatar_subscript: number;
  vip_nickname_color: string;
  vip: {
    type: number;
    status: number;
    due_date: number;
    vip_pay_type: number;
    theme_type: number;
    label: {
      path: string;
      text: string;
      label_theme: string;
      text_color: string;
      bg_style: number;
      bg_color: string;
      border_color: string;
      use_img_label: boolean;
      img_label_uri_hans: string;
      img_label_uri_hant: string;
      img_label_uri_hans_static: string;
      img_label_uri_hant_static: string;
      label_id: number;
      label_goto: {
        mobile: string;
        pc_web: string;
      };
    };
    avatar_subscript: number;
    nickname_color: string;
    role: number;
    avatar_subscript_url: string;
    tv_vip_status: number;
    tv_vip_pay_type: number;
    tv_due_date: number;
    avatar_icon: { icon_type: number; icon_resource: {} };
  };
  wallet: {
    mid: number;
    bcoin_balance: number;
    coupon_balance: number;
    coupon_due_time: number;
  };
  has_shop: boolean;
  shop_url: "";
  answer_status: number;
  is_senior_member: number;
  wbi_img: {
    img_url: string;
    sub_url: string;
  };
  is_jury: boolean;
  name_render: null;
}

export interface DataXpassportCookieInfo {
  refresh: boolean;
  timestamp: number;
}

export interface DataXpassportCookieRefresh {
  status: number;
  message: string;
  refresh_token: string;
}

export class BilibiliApiClientEx extends BilibiliApiClient {
  /** 生成登录二维码 */
  async xpassportQrcodeGenerate() {
    const res = await this.request(
      "https://passport.bilibili.com/x/passport-login/web/qrcode/generate"
    );
    return unwrapRequestData<DataXpassportQrcodeGenerate>(res);
  }

  /** 轮询登录二维码 */
  async xpassportQrcodePoll(params: { qrcode_key: string }) {
    const url = new URL(
      "https://passport.bilibili.com/x/passport-login/web/qrcode/poll"
    );
    url.searchParams.set("qrcode_key", params.qrcode_key);
    const res = await this.request(
      "https://passport.bilibili.com/x/passport-login/web/qrcode/generate"
    );
    const data = unwrapRequestData<DataXpassportQrcodePoll>(res);
    this.cookies.setFromHeaders(res.headers);
    return data;
  }

  /** 获取当前登录信息 */
  async xapiNav() {
    const res = await this.request(
      "https://api.bilibili.com/x/web-interface/nav"
    );
    return unwrapRequestData<DataXapiNav>(res);
  }

  async xpassportCookieInfo() {
    const res = await this.request(
      "https://passport.bilibili.com/x/passport-login/web/cookie/info"
    );
    return unwrapRequestData<DataXpassportCookieInfo>(res);
  }

  async wwwCorrespond(correspondPath: string) {
    const res = await this.request(
      `https://www.bilibili.com/correspond/1/${correspondPath}`
    );
    assertRequestOk(res);
    return res;
  }

  async xpassportCookieRefresh(params: {
    csrf: string;
    refresh_csrf: string;
    source?: string;
    refresh_token: string;
  }) {
    const url = new URL(
      "https://passport.bilibili.com/x/passport-login/web/cookie/refresh"
    );

    url.searchParams.set("csrf", params.csrf);
    url.searchParams.set("refresh_csrf", params.refresh_csrf);
    url.searchParams.set("source", params.source || "main_web");
    url.searchParams.set("refresh_token", params.refresh_token);
    const res = await this.request(url);
    const data = unwrapRequestData<DataXpassportCookieRefresh>(res);
    this.cookies.setFromHeaders(res.headers);
    return data;
  }
  async xpassportConfirmRefresh(params: {
    csrf: string;
    refresh_token: string;
  }) {
    const url = new URL(
      "https://passport.bilibili.com/x/passport-login/web/confirm/refresh"
    );
    url.searchParams.set("csrf", params.csrf);
    url.searchParams.set("refresh_token", params.refresh_token);
    const res = await this.request(url);

    return unwrapRequestData<unknown>(res);
  }

  async refreshCookie({
    timestamp,
    refresh_token,
  }: {
    timestamp: number;
    refresh_token: string;
  }) {
    // 生成CorrespondPath
    const correspondPath = await getCorrespondPath(timestamp);

    // 获取refresh_csrf
    const correspondRes = await this.wwwCorrespond(correspondPath);
    const correspondHtmlText = await correspondRes.text();
    const refresh_csrf = await correspondRefreshCsrf(correspondHtmlText);

    // 刷新cookie
    const { refresh_token: new_refresh_token } = (
      await this.xpassportCookieRefresh({
        csrf: this.cookies.get("bili_jct"),
        refresh_csrf,
        refresh_token,
      })
    ).data;

    // 确认更新
    await this.xpassportConfirmRefresh({
      csrf: this.cookies.get("bili_jct"),
      refresh_token,
    });

    return { cookie: this.cookie, refresh_token: new_refresh_token };
  }
}

const correspondRefreshCsrfRegex = /\<div id="1-name"\>([0-9a-zA-Z]+)\<\/div\>/;

export async function correspondRefreshCsrf(html: string) {
  const csrf = html.match(correspondRefreshCsrfRegex)?.[1];
  if (!csrf) throw new Error("无法提取refresh_csrf");
  return csrf;
}

export async function fetchLiveRoomData(client: BilibiliApiClient, id: number) {
  try {
    const res = await client.xliveGetInfoByRoom({
      room_id: id,
    });
    return parseGetInfoByRoom(res.data);
  } catch (e) {
    // fallback

    const res = await client.xliveGetRoomBaseInfo({
      room_ids: [id],
    });
    for (const r in res.data.by_room_ids) {
      return parseRoomBaseInfo(res.data.by_room_ids[r]);
    }
    throw new Error("房间不存在");
  }
}
