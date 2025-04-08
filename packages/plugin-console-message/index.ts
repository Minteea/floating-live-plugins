import {
  AppPluginExposesMap,
  BasePlugin,
  LiveMessage,
  UserInfo,
  UserType,
} from "floating-live";
import type {} from "@floating-live/platform";
import chalk from "chalk";

const log = console.log;

export class ConsoleMessage extends BasePlugin {
  static pluginName = "consoleMessage";
  private pluginPlatform?: AppPluginExposesMap["platform"];
  init() {
    this.ctx.whenRegister("platform", (platform) => {
      this.pluginPlatform = platform;
      return () => {
        this.pluginPlatform = undefined;
      };
    });

    this.ctx.on("live:message", ({ message }) => {
      this.log(message);
    });
  }

  /** 获取用户信息 */
  public getUserInfo(message: { platform: string; info: { user: UserInfo } }) {
    const list: string[] = [];
    const platform = message.platform;
    const { name, medal, membership, type } = message.info.user; // 用户信息
    if (medal) list.push(chalk.green(`[${medal.name}(${medal.level})] `));
    if (membership)
      list.push(
        chalk.cyan(`[${this.getMembershipName(platform, membership)}]`)
      );
    if (type)
      list.push(
        chalk.magenta(
          `[${{ [UserType.admin]: "房管", [UserType.anchor]: "主播" }[type]}]`
        )
      );
    list.push(chalk.yellow(name)); // 用户名

    return list.join(""); //[粉丝牌(等级)] [特权][房管]用户名
  }

  /** 获取直播间会员名称 */
  public getMembershipName(platform: string, level: number | boolean) {
    const membership = this.pluginPlatform?.get(platform)?.membership;
    return membership?.level?.[level as number] || membership?.name;
  }

  /** 获取货币名称 */
  public getCurrenyInfo(platform: string, name?: number | string) {
    const currency = this.pluginPlatform?.get(platform)?.currency;
    return (
      currency?.[name || 0] || {
        name: "",
        ratio: 1,
        money: 0,
      }
    );
  }

  /** 记录在控制台上 */
  log(message: LiveMessage.All) {
    switch (message.type) {
      case "comment": {
        let user = this.getUserInfo(message);
        let content = message.info.content;
        log(
          `${user}${chalk.dim(":")} ${
            message.info.image ? chalk.dim("[img]") : ""
          }${content}`
        );
        break;
      }
      case "like": {
        let user = this.getUserInfo(message);
        log(`${user} 点赞了`);
        break;
      }
      case "gift": {
        const user = this.getUserInfo(message);
        const { name, num, value, action = "送出" } = message.info.gift;
        const currency = this.getCurrenyInfo(
          message.platform,
          message.info.gift.currency
        );
        log(
          `${user} ${action} ${chalk.yellow(`${name} x${num}`)} ${chalk.dim(
            `(${value / currency.ratio}${currency.name})`
          )}`
        );
        break;
      }
      case "membership": {
        let user = this.getUserInfo(message);
        let name = message.info.name;
        log(chalk.bold(`${user} 开通了 ${chalk.yellow(name)}`));
        break;
      }
      case "superchat": {
        let user = this.getUserInfo(message);
        let second = Math.round(message.info.duration / 1000);
        log(
          chalk.bold(
            `${chalk.cyan(`[SC(${second}s)]`)} ${user}${chalk.dim(":")} ${
              message.info.content
            }`
          )
        );
        break;
      }
      case "entry": {
        let user = this.getUserInfo(message);
        log(`${user} 进入直播间`);
        break;
      }
      case "follow": {
        let user = this.getUserInfo(message);
        log(`${user} 关注了主播`);
        break;
      }
      case "share": {
        let user = this.getUserInfo(message);
        log(`${user} 分享了直播间`);
        break;
      }
      case "block": {
        let user = this.getUserInfo(message);
        let operator = message.info.operator.type
          ? { [UserType.admin]: "房管", [UserType.anchor]: "主播" }[
              message.info.operator.type
            ]
          : "";
        log(`${user} 已被${operator}禁言`);
        break;
      }
      case "live_start": {
        let roomKey = `${message.platform}:${message.roomId}`;
        log(
          chalk.bold(
            `${chalk.green("[+]")} 直播间 ${chalk.yellow(roomKey)} 已开播`
          )
        );
        break;
      }
      case "live_cut": {
        let roomKey = `${message.platform}:${message.roomId}`;
        let msg = message.info.message;
        log(
          chalk.bold(
            `${chalk.red("[!]")} 直播间 ${chalk.yellow(
              roomKey
            )} 被管理员切断${chalk.dim(":")} ${msg}`
          )
        );
        break;
      }
      case "live_end": {
        let roomKey = `${message.platform}:${message.roomId}`;
        log(
          chalk.bold(
            `${chalk.blue("[-]")} 直播间 ${chalk.yellow(roomKey)} 已结束直播`
          )
        );
      }
    }
  }
}

export default ConsoleMessage;
