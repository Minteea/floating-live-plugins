import {
  FloatingLive,
  Message,
  PlatformInfo,
  UserInfo,
  UserType,
} from "floating-live";

export class ConsoleMessage {
  static pluginName = "consoleMessage";
  readonly main: FloatingLive;
  constructor(main: FloatingLive) {
    this.main = main;
    main.on("live:message", (msg) => {
      this.log(msg);
    });
  }
  /** 获取用户信息 */
  public getUserInfo(message: { platform: string; info: { user: UserInfo } }) {
    let user = message.info.user; // 用户信息
    let name = `${"\x1b[33m"}${user.name}`; // 用户名
    let medal = user.medal
      ? `${"\x1b[32m"}[${user.medal.name}(${user.medal.level})] `
      : ""; // 粉丝牌
    let membership = user.membership
      ? `${"\x1b[36m"}[${this.getMembershipName(
          message.platform,
          user.membership
        )}]`
      : ""; // 直播间会员
    let admin = user.type
      ? `${"\x1b[95m"}[${
          { [UserType.admin]: "房管", [UserType.anchor]: "主播" }[user.type]
        }]`
      : ""; // 房管

    return `${medal}${membership}${admin}${name}${"\x1b[0m"}`; //[粉丝牌(等级)] [特权][房管]用户名
  }
  /** 获取直播间会员名称 */
  public getMembershipName(platform: string, level: number | boolean) {
    const membership = (
      this.main.manifest.get("platform")?.get(platform) as PlatformInfo
    )?.membership;
    return membership?.level?.[level as number] || membership?.name;
  }
  /** 获取货币名称 */
  public getCurrenyInfo(platform: string, name?: number | string) {
    const currency = (
      this.main.manifest.get("platform")?.get(platform) as PlatformInfo
    )?.currency;
    return (
      currency?.[name || 0] || {
        name: "",
        ratio: 1,
        money: 0,
      }
    );
  }
  /** 记录在控制台上 */
  log(message: Message.All) {
    switch (message.type) {
      case "comment": {
        let user = this.getUserInfo(message);
        let content = message.info.content;
        console.log(`${user}: ${message.info.image ? "[img]" : ""}${content}`);
        break;
      }
      case "like": {
        let user = this.getUserInfo(message);
        console.log(`${user} 点赞了`);
        break;
      }
      case "gift": {
        const user = this.getUserInfo(message);
        const action = message.info.gift.action || "送出";
        const name = message.info.gift.name;
        const num = message.info.gift.num;
        const value = message.info.gift.value;
        const currency = this.getCurrenyInfo(
          message.platform,
          message.info.gift.currency
        );
        console.log(
          `${user}${"\x1b[0m"} ${action} ${"\x1b[40;33m"}${name} x${num}${"\x1b[0m"} (${
            value / currency.ratio
          }${currency.name})`
        );
        break;
      }
      case "membership": {
        let user = this.getUserInfo(message);
        let name = message.info.name;
        console.log(
          `${user}${"\x1b[1;31m"} 开通了主播的${"\x1b[33m"}${name}${"\x1b[0m"}`
        );
        break;
      }
      case "superchat": {
        let user = this.getUserInfo(message);
        let second = Math.round(message.info.duration / 1000);
        console.log(
          `${"\x1b[1;36m"}SC(${second}s) ${user}${"\x1b[0m"}: ${
            message.info.content
          }`
        );
        break;
      }
      case "entry": {
        let user = this.getUserInfo(message);
        console.log(`${user} 进入直播间`);
        break;
      }
      case "follow": {
        let user = this.getUserInfo(message);
        console.log(`${user} 关注了主播`);
        break;
      }
      case "share": {
        let user = this.getUserInfo(message);
        console.log(`${user} 分享了直播间`);
        break;
      }
      case "block": {
        let user = this.getUserInfo(message);
        let operator = message.info.operator.type
          ? { [UserType.admin]: "房管", [UserType.anchor]: "主播" }[
              message.info.operator.type
            ]
          : "";
        console.log(`${user} 已被${operator}禁言`);
        break;
      }
      case "live_start": {
        let roomKey = `${message.platform}:${message.room}`;
        console.log(`[+] 直播间${"\x1b[40;33m"} ${roomKey} ${"\x1b[0m"}已开播`);
        break;
      }
      case "live_cut": {
        let roomKey = `${message.platform}:${message.room}`;
        let msg = message.info.message;
        console.log(
          `[!] ${"\x1b[1;31m"}直播间${"\x1b[40;33m"} ${roomKey} ${"\x1b[1;31m"}被管理员切断${"\x1b[0m"}: ${msg}`
        );
        break;
      }
      case "live_end": {
        let roomKey = `${message.platform}:${message.room}`;
        console.log(
          `[-] ${"\x1b[1;31m"}直播间${"\x1b[40;33m"} ${roomKey} ${"\x1b[1;31m"}已结束直播${"\x1b[0m"}`
        );
      }
    }
  }
}

export default ConsoleMessage;
