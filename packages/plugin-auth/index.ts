import {
  AppPluginExposesMap,
  BasePlugin,
  UserInfo,
  ValueContext,
} from "floating-live";

declare module "floating-live" {
  interface AppCommandMap {
    auth: (
      platform: string,
      credentials: string
    ) => Promise<{
      credentials: string;
      isLogin: boolean;
      user: UserInfo | null;
    }>;
    "auth.set": (platform: string, credentials: string) => void;
    "auth.check": (
      platform: string,
      credentials: string
    ) => Promise<{
      credentials: string;
      isLogin: boolean;
      user: UserInfo | null;
    }>;
    [name: `${string}.credentials.check`]: (credentials: string) => Promise<{
      credentials: string;
      isLogin: boolean;
      user: UserInfo | null;
    }>;
  }
  interface AppEventDetailMap {
    "auth:update": { platform: string; user: UserInfo | null };
  }
  interface AppValueMap {
    [name: `auth.user.${string}`]: UserInfo | null;
  }
  interface LiveRoom {
    setCredentials?(credentials: string, tokens?: Record<string, any>): void;
  }
}

export class Auth extends BasePlugin {
  static pluginName = "auth";
  private readonly list = new Map<
    string,
    { credentials: string; tokens?: Record<string, any> }
  >();
  private authValueContext = new Map<string, ValueContext<UserInfo | null>>();
  private readonly info: Record<string, UserInfo | null> = {};
  room: AppPluginExposesMap["room"] | null = null;
  init() {
    this.ctx.whenRegister("room", (room) => {
      this.room = room;
      return () => {
        this.room = null;
      };
    });

    this.ctx.registerCommand("auth", (e, platform, credentials) => {
      return this.auth(platform, credentials);
    });
    this.ctx.registerCommand("auth.set", (e, platform, credentials) => {
      return this.set(platform, credentials);
    });
    this.ctx.registerCommand("auth.check", (e, platform, credentials) => {
      return this.check(platform, credentials);
    });

    this.ctx.useHook("room.add", ({ platform, id, options }) => {
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
      this.set(platform, result.credentials);
      this.setAuthInfo(platform, result.user);
    }
    return result;
  }
  private setAuthInfo(platform: string, user: UserInfo | null) {
    this.info[platform] = user;
    this.ctx.emit("auth:update", { platform, user });
    if (!this.ctx.hasValue(`auth.user.${platform}`)) {
      const valueCtx = this.ctx.registerValue(`auth.user.${platform}`, {
        get: () => this.info[platform],
      });
      this.authValueContext.set(platform, valueCtx);
    } else {
      this.authValueContext.get(platform)?.emit(user);
    }
  }
  /** 直接设置用户凭据 */
  set(platform: string, credentials: string) {
    this.list.set(platform, { credentials });
    this.update(platform, credentials);
  }
  /** 更新现有房间的用户凭据 */
  update(platform: string, credentials: string, tokens?: Record<string, any>) {
    this.room?.getList().forEach((r) => {
      r?.platform == platform && r.setCredentials?.(credentials, tokens);
    });
  }
  /** 检查cookie并补充缺失的字段，返回完整cookie和用户tokens */
  async check(platform: string, credentials: string) {
    return await this.ctx.call(`${platform}.credentials.check`, credentials);
  }
}

export default Auth;
