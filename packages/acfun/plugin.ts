import {
  BasePlugin,
  PluginContext,
  LiveRoomStatus,
  type LivePlatformInfo,
} from "floating-live";
import { RoomAcfun } from "./room";
import {
  getDid,
  getStartPlayInfo,
  parseCookieString,
  userLogin,
  visitorLogin,
} from "./utils";
import type {} from "@floating-live/platform";

declare module "floating-live" {
  interface AppCommandMap {
    "acfun.credentials.check": (credentials: string) => Promise<{
      credentials: string;
      tokens: {
        did: string;
        userId: number;
        st: string;
        security: string;
      };
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
        return new RoomAcfun(Number(id), config);
      }
    );

    ctx.registerCommand("acfun.room.data", async (e, id: string | number) => {
      if (!this.tokens) {
        const did = await getDid();
        const { userId, st } = await visitorLogin(did);
        this.tokens = {
          userId,
          did,
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
          st: st,
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
        connection: 0,
        opened: false,
      };
    });

    ctx.registerCommand("acfun.credentials.check", async (e, credentials) => {
      const cookie = parseCookieString(credentials);
      const did = cookie._did || (await getDid());
      const acPasstoken = cookie["acPasstoken"];
      const authKey = cookie["auth_key"];
      if (acPasstoken && authKey) {
        const result = await userLogin(did, acPasstoken, authKey).catch(
          () => undefined
        );
        if (result) {
          const { st, userId, security } = result;
          return {
            credentials,
            tokens: { did, st, userId, security },
            userId,
          };
        }
      }
      const { st, userId, security } = await visitorLogin(did);
      return {
        credentials: cookie._did ? credentials : `_did=${did}`,
        tokens: { did, st, userId, security },
        userId: 0,
      };
    });
  }
}

export default PluginAcfun;
