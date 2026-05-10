import chalk from "chalk";
import { BasePlugin, PluginContext } from "floating-live";

const log = console.log;

export class ConsoleEvent extends BasePlugin {
  static pluginName = "consoleEvent";
  constructor(ctx: PluginContext) {
    super(ctx);
    ctx.on("room:connecting", ({ key }) => {
      log(`[${key}]正在连接服务器`);
    });
    ctx.on("room:connected", ({ key }) => {
      log(`[${key}]已连接到服务器`);
    });
    ctx.on("room:enter", ({ key }) => {
      log(`[${key}]已连接到直播间`);
    });
    ctx.on("room:disconnect", ({ key }) => {
      log(`[${key}]与直播服务器的连接已断开`);
    });
    ctx.on("room:update", ({ key, room }) => {
      log(`[${key}]已获取到房间信息`);

      const status = {
        [-2]: "已锁定",
        [-1]: "已封禁",
        [0]: "未开播",
        [1]: "直播中",
        [2]: "轮播中",
      }[room.status];
      const anchor = room.anchor.name;
      const { title, area } = room.detail;

      log(
        `[${status}] ${anchor}${chalk.dim(":")} ${chalk.bold.yellow(
          title
        )}  ${chalk.dim(area?.join(">") || "")}`
      );
    });
    ctx.on("room:detail", ({ key, detail }) => {
      log(`[${key}]直播间信息更新`);

      const list: string[] = [];
      if (detail.title)
        list.push(`${chalk.dim("[标题]")} ${chalk.bold(detail.title)}`);
      if (detail.area)
        list.push(
          `${chalk.dim("[分区]")} ${chalk.bold(detail.area.join(">"))}`
        );
      log(list.join("  "));
    });
    ctx.on("room:open", ({ key }) => {
      log(`[${key}]房间已打开`);
    });
    ctx.on("room:close", ({ key }) => {
      log(`[${key}]房间已关闭`);
    });
    ctx.on("room:add", ({ key }) => {
      log(`[room]已添加房间: ${key}`);
    });
    ctx.on("room:remove", ({ key }) => {
      log(`[room]已移除房间: ${key}`);
    });
    ctx.on("plugin:register", ({ pluginName }) => {
      log(`[plugin]已添加插件: ${pluginName}`);
    });
    ctx.on("plugin:unregister", ({ pluginName }) => {
      log(`[plugin]已移除插件: ${pluginName}`);
    });
  }
}

export default ConsoleEvent;
