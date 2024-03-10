import { FloatingLive } from "floating-live";
import ConsoleMessage from "../packages/console-message";
// import { messageSave, messageSaveRaw } from "../packages/save";
import Bilibili from "../packages/bilibili";
import Acfun from "../packages/acfun";
import ConsoleEvent from "../packages/console-event";
import Auth from "../packages/auth";
import { SaveMessage, SaveRaw } from "../packages/save";

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
floating.plugin.register(ConsoleEvent as any);
floating.plugin.register(Auth as any);
floating.plugin.register(Bilibili as any);
floating.plugin.register(Acfun as any);

// 初始化内置插件
floating.plugin.register(ConsoleMessage as any);
floating.plugin.register(SaveMessage as any);
floating.plugin.register(SaveRaw as any);

async function lifeCycle() {
  console.log("Floating Live is on :)");
}

lifeCycle()
  .then(() => beforeInit())
  .then(() => init());

async function beforeInit() {
  // 此处可设置自己的b站登录凭据，以解除b站未登录状态下返回打码弹幕的限制
  // b站的登录凭据可在cookie中获取，注意不要将cookie泄露给其他人
  // floating.call("auth", "bilibili", "SESSDATA=xxxxxxxxxxxxxxxxxxxx");
  await floating.call(
    "auth",
    "bilibili",
    "SESSDATA=cf52704e%2C1725594782%2C67a0b%2A32CjCuTYQsSSUttjUwBKfWMxZmYFM1_quU9auOr2OBeXGKyPOaRRMbTCqWsHZET8EuABwSVnoyaVFiVlhSU0FuUmNHVXM0SUVhcC14dEFNbklPYjJ2c0ZCMVJOMV9RbU9wQlVqUzFVOFdacmFvOUM4dThOTzZxcVpvQm93VUl3N214VzZtR0R5Q3p3IIEC"
  );
  await floating.call("auth", "acfun", "");
  console.log(floating.command.getSnapshot());
}

function init() {
  options.rooms.forEach(({ platform, id }) => {
    floating.room.add(platform, id, { open: options.open });
  });
}
