import {
  BasePlugin,
  PluginContext,
  LiveRoomStatus,
  type LivePlatformInfo,
} from "floating-live";
import { RoomAcfun } from "./room";
import {
  requestDidCookie,
  getStartPlayInfo,
  requestTokenGet,
  requestVisitorLogin,
  Cookies,
} from "acfun-live-danmaku";
import type {} from "@floating-live/platform";

declare module "floating-live" {
  interface AppCommandMap {
    "acfun.credentials.check": (credentials: string) => Promise<{
      credentials: string;
      userId: number;
    }>;
  }
}

const platformInfo: LivePlatformInfo = {
  name: "acfun",
  gift: {
    action: "送出",
  },
  currency: {
    1: {
      name: "AC币",
      ratio: 1,
      money: 10,
    },
    2: {
      name: "香蕉",
      ratio: 1,
    },
  },
  stats: {
    online: "在线",
    like: "点赞",
  },
};

export class PluginAcfun extends BasePlugin {
  static pluginName = "acfun";
  private tokens: { did: string; userId: number; st: string } | null = null;
  init(ctx: PluginContext) {
    ctx.whenRegister("platform", (platform) => {
      platform.register("acfun", platformInfo, ctx.signal);
    });

    ctx.registerCommand(
      "acfun.room.create",
      (e, id: string | number, config?: object) => {
        const room = new RoomAcfun(Number(id), config);
        room.whenInit.catch((e) => console.error(e));
        return room;
      }
    );

    ctx.registerCommand("acfun.room.data", async (e, id: string | number) => {
      if (!this.tokens) {
        const cookies = new Cookies(await requestDidCookie());
        const { userId, "acfun.api.visitor_st": st } =
          await requestVisitorLogin({
            cookie: cookies.toString(),
          });
        this.tokens = {
          userId,
          did: cookies.get("_did"),
          st,
        };
      }
      const authorId = parseInt("" + id);
      const { did, userId, st } = { ...this.tokens };
      const { liveId, caption, liveStartTime, enterRoomAttach } =
        await getStartPlayInfo({
          authorId,
          userId: userId,
          did: did,
          "acfun.api.visitor_st": st,
        }).catch(() => ({
          liveId: "",
          caption: "",
          liveStartTime: 0,
          availableTickets: [] as string[],
          enterRoomAttach: "",
        }));
      const { profile } = await fetch(
        `https://live.acfun.cn/rest/pc-direct/user/userInfo?userId=${authorId}`,
        {
          method: "GET",
        }
      ).then((response) => response.json());
      return {
        platform: "acfun",
        id: authorId,
        key: `acfun:${authorId}`,
        liveId: liveId,
        detail: {
          title: caption,
          cover: liveId
            ? `https://tx2.a.kwimgs.com/bs2/ztlc/cover_${liveId}_raw.jpg`
            : undefined,
        },
        anchor: {
          id: authorId,
          name: profile.name,
          avatar: profile.headUrl,
        },
        status: liveId ? LiveRoomStatus.live : LiveRoomStatus.off,
        timestamp: liveStartTime,
        available: !!enterRoomAttach,
        connectionStatus: 0,
        openStatus: 0,
        opened: false,
      };
    });

    ctx.registerCommand("acfun.credentials.check", (e, credentials) =>
      this.checkCredentials(credentials)
    );
  }
  async checkCredentials(credentials: string) {
    let cookies = new Cookies<"_did" | "acPasstoken" | "auth_key">(credentials);

    // 若没有_did信息，则重置cookie
    if (!cookies.get("_did")) {
      cookies = new Cookies(
        (await requestDidCookie().catch((e) =>
          this.throw(
            new this.Error("credentials:check_failed", {
              message: "无法获取必要cookie信息",
              cause: e,
            })
          )
        ))!
      );
    }

    // 如果有acPasstoken和authKey，代表用户已经登录
    if (cookies.has("acPasstoken") && cookies.has("auth_key")) {
      const result = await requestTokenGet({
        cookie: cookies.toString(),
      }).catch((e) =>
        this.throw(
          new this.Error("credentials:check_failed", {
            message: "获取token失败(登录模式)",
            cause: e,
          })
        )
      );
      const { userId } = result!;
      return {
        credentials: cookies.toString(),
        userId,
      };
    } else {
      return {
        credentials: cookies.toString(),
        userId: 0,
      };
    }
  }
}

export default PluginAcfun;
