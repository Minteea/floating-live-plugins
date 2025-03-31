import { BasePlugin, PluginContext } from "floating-live";

export class ConsoleEvent extends BasePlugin {
  static pluginName = "consoleEvent";
  constructor(ctx: PluginContext) {
    super(ctx);
    ctx.on("room:connecting", ({ key }) => {
      console.log(`[${key}]正在连接服务器`);
    });
    ctx.on("room:connected", ({ key }) => {
      console.log(`[${key}]已连接到服务器`);
    });
    ctx.on("room:enter", ({ key }) => {
      console.log(`[${key}]已连接到直播间`);
    });
    ctx.on("room:disconnect", ({ key }) => {
      console.log(`[${key}]与直播服务器的连接已断开`);
    });
    ctx.on("room:update", ({ key }) => {
      console.log(`[${key}]已获取到房间信息`);
    });
    ctx.on("room:detail", ({ key }) => {
      console.log(`[${key}]直播间信息更新`);
    });
    ctx.on("room:open", ({ key }) => {
      console.log(`[${key}]房间已打开`);
    });
    ctx.on("room:close", ({ key }) => {
      console.log(`[${key}]房间已关闭`);
    });
    ctx.on("room:add", ({ key }) => {
      console.log(`[room]已添加房间: ${key}`);
    });
    ctx.on("room:remove", ({ key }) => {
      console.log(`[room]已移除房间: ${key}`);
    });
    ctx.on("plugin:register", ({ pluginName }) => {
      console.log(`[plugin]已添加插件: ${pluginName}`);
    });
    ctx.on("plugin:unregister", ({ pluginName }) => {
      console.log(`[plugin]已移除插件: ${pluginName}`);
    });
  }
}

export default ConsoleEvent;
