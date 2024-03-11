import { FloatingLive } from "floating-live";

declare module "floating-live" {
  interface FloatingCommandMap {
    auth: (platform: string, credentials: string) => Promise<void>;
    "auth.set": (
      platform: string,
      credentials: string,
      tokens?: Record<string, any>
    ) => void;
    "auth.check": (
      platform: string,
      credentials: string
    ) => Promise<{
      credentials: string;
      tokens?: Record<string, any>;
      userId?: string;
    } | void>;
    [name: `${string}.credentials.check`]: (
      credentials: string,
      tokens?: Record<string, any>
    ) => Promise<{
      credentials: string;
      tokens?: Record<string, any>;
      userId?: string;
    }>;
  }
  interface FloatingEventMap {
    "auth:update": (platform: string, userId: string | number) => void;
  }
  interface LiveRoom {
    setCredentials?(credentials: string, tokens?: Record<string, any>): void;
  }
}

class Auth {
  static pluginName = "auth";
  readonly main: FloatingLive;
  private readonly list = new Map<
    string,
    { credentials: string; tokens?: Record<string, any> }
  >();
  constructor(main: FloatingLive) {
    this.main = main;
    main.command.register("auth", (platform, credentials) => {
      return this.auth(platform, credentials);
    });
    main.command.register("auth.set", (platform, credentials, tokens) => {
      return this.set(platform, credentials, tokens);
    });
    main.command.register("auth.check", (platform, credentials) => {
      return this.check(platform, credentials);
    });

    this.main.hook.register("room.add", ({ platform, id, options }) => {
      const auths = this.list.get(platform);
      if (!auths) return;
      options.credentials ??= auths.credentials;
      options.tokens ??= auths.tokens;
    });
  }
  /** 检测并设置用户凭据 */
  async auth(platform: string, credentials: string) {
    const result = await this.check(platform, credentials);
    if (result) {
      this.set(platform, result.credentials, result.tokens);
    }
  }
  /** 直接设置用户凭据 */
  set(platform: string, credentials: string, tokens?: Record<string, any>) {
    this.list.set(platform, { credentials, tokens });
    this.update(platform, credentials, tokens);
  }
  /** 更新现有房间的用户凭据 */
  update(platform: string, credentials: string, tokens?: Record<string, any>) {
    this.main.room.keys.forEach((k) => {
      const room = this.main.room.get(k);
      room?.platform == platform && room.setCredentials?.(credentials, tokens);
    });
  }
  /** 检查cookie并补充缺失的字段，返回完整cookie和用户tokens */
  async check(platform: string, credentials: string) {
    return await this.main.call(`${platform}.credentials.check`, credentials);
  }
}

export default Auth;
