import { FloatingLive } from "floating-live";
import ConsoleMessage from "../packages/plugin-console-message";
// import { messageSave, messageSaveRaw } from "../packages/save";
import { PluginBilibili } from "../packages/bilibili";
import { PluginAcfun } from "../packages/acfun";
import ConsoleEvent from "../packages/plugin-console-event";
import Auth from "../packages/plugin-auth";
import Save from "../packages/plugin-save";

const options = {
  rooms: [
    {
      platform: "bilibili",
      id: 6136246,
    },
    /* {
      platform: "acfun",
      id: 1345673,
    }, */
  ],
  open: true,
};

// 创建live实例
const floating = new FloatingLive();
floating.plugin.register(ConsoleEvent);
floating.plugin.register(Auth);
floating.plugin.register(PluginBilibili);
floating.plugin.register(PluginAcfun);

// 初始化内置插件
floating.plugin.register(ConsoleMessage);
floating.plugin.register(Save);

async function lifeCycle() {
  console.log("Floating Live is on :)");
}

lifeCycle()
  .then(() => beforeInit())
  .then(() => init());

async function beforeInit() {
  // 此处可设置自己的b站登录凭据，以解除b站未登录状态下返回打码弹幕的限制
  // b站的登录凭据可在cookie中获取，注意不要将cookie泄露给其他人
  await floating.call("auth", "bilibili", "SESSDATA=xxxxxxxxxxxxxxxxxxxx");
  console.log(floating.command.getSnapshot());
}

function init() {
  options.rooms.forEach(({ platform, id }) => {
    floating.room.add(platform, id, { open: options.open });
  });
}
