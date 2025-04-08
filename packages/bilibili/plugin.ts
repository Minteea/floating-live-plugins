import {
  BasePlugin,
  PluginContext,
  type CommandContext,
  type FloatingLive,
  type LivePlatformInfo,
} from "floating-live";
import { RoomBilibili, RoomOptions } from "./room";
import { checkLoginQRcode, qrcodeGenerate } from "./utils";
import {
  requestGetInfoByRoom,
  getLoginUid,
  Cookies,
} from "bilibili-live-danmaku";
import { parseGetInfoByRoom } from "./parser";
import type {} from "@floating-live/platform";

interface BilibiliLoginInfo {
  credentials: string;
  userId: number;
}

declare module "floating-live" {
  interface AppCommandMap {
    "bilibili.credentials.check": (
      credentials: string
    ) => Promise<BilibiliLoginInfo>;
    "bilibili.login.qrcode.get": () => Promise<{ key: string; url: string }>;
    "bilibili.login.qrcode.poll": (
      key: string
    ) => Promise<{ status: number; credentials?: string }>;
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
  init(ctx: PluginContext) {
    ctx.whenRegister("platform", (platform) => {
      platform.register("bilibili", platformInfo, ctx.signal);
    });

    ctx.registerCommand(
      "bilibili.room.create",
      (e, id: string | number, options?: RoomOptions) => {
        return new RoomBilibili(Number(id), options);
      }
    );
    ctx.registerCommand(
      "bilibili.room.data",
      async (e, id: string | number) => {
        const rawInfo = await requestGetInfoByRoom(parseInt("" + id));
        return parseGetInfoByRoom(rawInfo);
      }
    );

    ctx.registerCommand(
      "bilibili.credentials.check",
      async (e, credentials) => {
        const buvid = new Cookies(credentials).get("buvid3");
        const userId = await getLoginUid({ cookie: credentials });
        return {
          credentials,
          userId,
        };
      }
    );

    ctx.registerCommand("bilibili.login.qrcode.get", () => {
      return qrcodeGenerate();
    });

    ctx.registerCommand("bilibili.login.qrcode.poll", async (e, key) => {
      const [status, credentials] = await checkLoginQRcode(key);
      return { status, credentials };
    });
  }
}

export default PluginBilibili;
