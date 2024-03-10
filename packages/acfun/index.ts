import type { FloatingLive, PlatformInfo } from "floating-live";
import acfunLive from "./room";
import { getDid, parseCookieString, visitorLogin } from "./utils";

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

class Acfun {
  static pluginName = "acfun";
  constructor(main: FloatingLive) {
    main.command.register(
      "acfun.room.create",
      (id: string | number, config?: object) => {
        return new acfunLive(Number(id), config);
      }
    );

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

export default Acfun;
