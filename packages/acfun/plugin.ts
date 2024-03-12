import {
  RoomStatus,
  type FloatingLive,
  type PlatformInfo,
} from "floating-live";
import { RoomAcfun } from "./room";
import {
  getDid,
  getStartPlayInfo,
  parseCookieString,
  visitorLogin,
} from "./utils";

declare module "floating-live" {
  interface FloatingCommandMap {
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

const platformInfo: PlatformInfo = {
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

export class PluginAcfun {
  static pluginName = "acfun";
  private tokens: { did: string; userId: number; st: string } | null = null;
  constructor(main: FloatingLive) {
    main.command.register(
      "acfun.room.create",
      (id: string | number, config?: object) => {
        return new RoomAcfun(Number(id), config);
      }
    );

    main.command.register("acfun.room.info", async (id: string | number) => {
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
          cover: `https://tx2.a.kwimgs.com/bs2/ztlc/cover_${liveId}_raw.jpg`,
        },
        anchor: {
          id: authorId,
          name: profile.name,
          avatar: profile.avatar,
        },
        status: liveId ? RoomStatus.live : RoomStatus.off,
        timestamp: liveStartTime,
        available: !!enterRoomAttach,
        connection: 0,
        opened: false,
      };
    });

    main.command.register("acfun.credentials.check", async (credentials) => {
      const cookie = parseCookieString(credentials);
      const did = cookie._did || (await getDid());
      const acPasstoken = cookie["acPasstoken"];
      const authKey = cookie["auth_key"];
      if (acPasstoken && authKey) {
        const result = await visitorLogin(did).catch(() => undefined);
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

    main.manifest.register("platform", "acfun", platformInfo);
  }
}

export default PluginAcfun;
