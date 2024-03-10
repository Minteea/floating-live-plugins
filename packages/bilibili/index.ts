import type { FloatingLive, PlatformInfo } from "floating-live";
import { RoomBilibili, RoomOptions } from "./room";
import {
  checkLoginQRcode,
  generateLoginQRcode,
  getBuvid,
  getLoginUid,
  parseCookieString,
} from "./utils";

interface BilibiliLoginInfo {
  credentials: string;
  tokens: {
    /** 用户uid */
    userId: number;
    /** buvid */
    buvid: string;
  };
  userId: number;
}

declare module "floating-live" {
  interface FloatingCommandMap {
    "bilibili.credentials.check": (
      credentials: string
    ) => Promise<BilibiliLoginInfo>;
    "bilibili.login.qrcode.get": () => Promise<{ key: string; url: string }>;
    "bilibili.login.qrcode.poll": (
      key: string
    ) => Promise<{ status: number; credentials?: string }>;
  }
}

const platformInfo: PlatformInfo = {
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

class Bilibili {
  static pluginName = "bilibili";
  constructor(main: FloatingLive) {
    main.command.register(
      "bilibili.room.create",
      (id: string | number, options?: RoomOptions) => {
        return new RoomBilibili(Number(id), options);
      }
    );

    main.command.register("bilibili.credentials.check", async (credentials) => {
      const buvid = (await getBuvid(credentials)) || "";
      const userId = await getLoginUid(credentials);
      return {
        credentials,
        tokens: {
          userId,
          buvid,
        },
        userId,
      };
    });

    main.manifest.register("platform", "bilibili", platformInfo);

    main.command.register("bilibili.login.qrcode.get", () => {
      return generateLoginQRcode();
    });

    main.command.register("bilibili.login.qrcode.poll", async (key) => {
      const [status, credentials] = await checkLoginQRcode(key);
      return { status, credentials };
    });
  }
}

export default Bilibili;
