import {
  AppPluginExposesMap,
  BasePlugin,
  PluginContext,
  UserInfo,
  type CommandContext,
  type FloatingLive,
  type LivePlatformInfo,
} from "floating-live";
import { RoomBilibili, RoomOptions } from "./room";
import type {} from "@floating-live/platform";
import { BilibiliApiClientEx, fetchLiveRoomData } from "./utils/request";
import { RequestError } from "bilibili-live-danmaku";

interface BilibiliLoginInfo {
  credentials: string;
  isLogin: boolean;
  user: UserInfo | null;
  refreshed: boolean;
}

declare module "floating-live" {
  interface AppCommandMap {
    /** 检测并更新登录cookie有效性 */
    "bilibili.credentials.check": (
      credentials: string
    ) => Promise<BilibiliLoginInfo>;

    /** 设置UA */
    "bilibili.client.userAgent": (credentials: string) => string;

    /** 使用cookie登录 */
    "bilibili.credentials.set": (credentials: string) => string;

    /** 获取二维码 */
    "bilibili.login.qrcode.get": () => Promise<{ key: string; url: string }>;

    /** 轮询二维码登录状态 */
    "bilibili.login.qrcode.poll": (key: string) => Promise<{
      status: number;
      message?: string;
      credentials?: string;
    }>;
  }
}

const platformInfo: LivePlatformInfo = {
  name: "bilibili",
  membership: {
    id: "guard",
    name: "大航海",
    level: ["", "总督", "提督", "舰长"],
  },
  gift: {
    action: "投喂",
  },
  currency: {
    silver: {
      name: "银瓜子",
      ratio: 1,
    },
    gold: {
      name: "电池",
      ratio: 100,
      money: 1000,
    },
  },
  stats: {
    view: "看过",
    online: "在线",
    like: "点赞",
  },
};

export interface PluginOptions {
  userAgent: string;
}

export class PluginBilibili extends BasePlugin {
  static pluginName = "bilibili";
  apiClient = new BilibiliApiClientEx();
  room: AppPluginExposesMap["room"] | null = null;
  init(ctx: PluginContext) {
    ctx.whenRegister("platform", (platform) => {
      platform.register("bilibili", platformInfo, ctx.signal);
    });
    ctx.whenRegister("room", (room) => {
      this.room = room;
      return () => {
        this.room = null;
      };
    });

    ctx.registerCommand(
      "bilibili.room.create",
      (e, id: string | number, options?: RoomOptions) => {
        return new RoomBilibili(Number(id), {
          credentials: this.apiClient.cookie,
          userAgent: this.apiClient.userAgent,
          fetch: this.apiClient.fetch,
          ...options,
        });
      }
    );
    ctx.registerCommand(
      "bilibili.room.data",
      async (e, id: string | number) => {
        return await fetchLiveRoomData(this.apiClient, parseInt(id.toString()));
      }
    );

    ctx.registerCommand(
      "bilibili.credentials.check",
      async (e, credentials) => {
        let refreshed = true;

        const apiClient = new BilibiliApiClientEx({
          cookie: credentials,
          userAgent: this.apiClient.userAgent,
          fetch: this.apiClient.fetch,
        });

        // 如buvid3缺失，则初始化cookie
        if (!apiClient.cookies.has("buvid3")) {
          await apiClient.initCookie();
        }

        try {
          // 检测cookie是否需要更新
          const { refresh, timestamp } = (await apiClient.xpassportCookieInfo())
            .data;

          if (refresh) {
            const refresh_token = apiClient.cookies.get("refresh_token");

            if (refresh_token) {
              // 如果存在refresh_token字段，则刷新cookie，否则将检查结果标记为未刷新
              const { refresh_token: new_refresh_token } =
                await apiClient.refreshCookie({
                  timestamp,
                  refresh_token,
                });
              apiClient.cookies.set("refresh_token", new_refresh_token);
            } else {
              refreshed = false;
            }
          }

          // 检测登录状态
          const data = (await apiClient.xapiNav()).data;
          return {
            credentials,
            isLogin: true,
            user: {
              id: data.mid,
              name: data.uname,
              avatar: data.face,
            },
            refreshed,
          };
        } catch (e) {
          if ((e as RequestError).ok && (e as RequestError).code == -101) {
            // 用户未登录
            return {
              credentials,
              data: {},
              isLogin: false,
              user: null,
              refreshed,
            };
          } else {
            throw e;
          }
        }
      }
    );

    ctx.registerCommand(
      "bilibili.credentials.set",
      (e, credentials: string) => {
        return this.setCredentials(credentials);
      }
    );
    ctx.registerCommand("bilibili.client.userAgent", (e, userAgent: string) => {
      return this.setUserAgent(userAgent);
    });

    ctx.registerCommand("bilibili.login.qrcode.get", async () => {
      const { qrcode_key, url } = (
        await this.apiClient.xpassportQrcodeGenerate()
      ).data;
      return { key: qrcode_key, url };
    });

    ctx.registerCommand("bilibili.login.qrcode.poll", async (e, key) => {
      const data = await this.apiClient.xpassportQrcodePoll({
        qrcode_key: key,
      });
      const { code, message, refresh_token } = data.data;
      if (code == 86101) {
        // 未扫码
        return { status: 1, message };
      } else if (code == 86090) {
        // 等待确认
        return { status: 2, message };
      } else if (code == 0) {
        // 扫码成功
        this.apiClient.cookies.set("refresh_token", refresh_token);
        return { status: 0, message, credentials: this.apiClient.cookie };
      } else if (code == 86038) {
        // 二维码失效
        return { status: -1, message };
      } else {
        throw new RequestError({ ok: true, code, message });
      }
    });
  }

  /** 设置登录凭证 */
  setCredentials(cookie: string) {
    this.apiClient.setCookie(cookie);
    (this.room?.getList() as RoomBilibili[])
      ?.filter((r) => r.platform == "bilibili")
      .forEach((r) => {
        r.setCredentials(cookie);
      });
    return cookie;
  }
  /** 设置UA */
  setUserAgent(userAgent: string) {
    this.apiClient.userAgent = userAgent;
    (this.room?.getList() as RoomBilibili[])
      ?.filter((r) => r.platform == "bilibili")
      .forEach((r) => {
        r.userAgent = userAgent;
      });
    return userAgent;
  }
}

export default PluginBilibili;
