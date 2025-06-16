import { FloatingLive } from "floating-live";
import ConsoleMessage from "@floating-live/plugin-console-message";
// import { messageSave, messageSaveRaw } from "../packages/save";
import { PluginBilibili } from "../packages/bilibili";
import { PluginAcfun } from "../packages/acfun";
import ConsoleEvent from "@floating-live/plugin-console-event";
import Auth from "@floating-live/plugin-auth";
import Save from "@floating-live/plugin-save";
import PluginPlatform from "@floating-live/platform";

const options = {
  rooms: [
    /*     {
      platform: "bilibili",
      id: 22603245, //6136246,
    }, */
    {
      platform: "acfun",
      id: 23682490,
    },
  ],
  open: true,
};

try {
  const dotenv = await import("dotenv");
  dotenv.config().parsed;
} catch (e) {
  console.warn("不支持dotenv");
}

function getEnv(key: string) {
  return (
    globalThis.process?.env?.[key] ||
    (globalThis as any).Deno?.env?.get(key) ||
    undefined
  );
}

// 创建live实例
const floating = new FloatingLive();

function registerPlugin() {
  return Promise.all([
    floating.register(ConsoleEvent),
    floating.register(PluginPlatform),
    floating.register(Auth),
    floating.register(PluginBilibili),
    floating.register(PluginAcfun),

    // 初始化内置插件
    floating.register(ConsoleMessage),
    floating.register(Save, { message: true, raw: true, path: "./saves" }),
  ]);
}

async function lifeCycle() {
  console.log("Floating Live is on :)");
}

lifeCycle()
  .then(() => registerPlugin())
  .then(() => beforeInit())
  .then(() => init())
  .catch((e) => console.error(e));

async function beforeInit() {
  // 此处可设置自己的b站登录凭据，以解除b站未登录状态下返回打码弹幕的限制
  // b站的登录凭据可在cookie中获取，注意不要将cookie泄露给其他人
  await floating.call(
    "auth",
    "bilibili",
    getEnv("API_COOKIES_BILIBILI") || "" // "SESSDATA=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  );
}

async function init() {
  for (const { platform, id } of options.rooms) {
    await floating.room.add(platform, id, { open: options.open });
  }
}
