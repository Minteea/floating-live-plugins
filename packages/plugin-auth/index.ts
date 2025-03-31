import {
  AppPluginExposesMap,
  BasePlugin,
  FloatingLive,
  ValueContext,
} from "floating-live";

declare module "floating-live" {
  interface AppCommandMap {
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
      userId?: string | number;
    } | void>;
    [name: `${string}.credentials.check`]: (
      credentials: string,
      tokens?: Record<string, any>
    ) => Promise<{
      credentials: string;
      tokens?: Record<string, any>;
      userId?: string | number;
    }>;
  }
  interface AppEventDetailMap {
    "auth:update": { platform: string; userId?: string | number };
  }
  interface AppValueMap {
    [name: `auth.userId.${string}`]: number | string | undefined;
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
  private authValueContext = new Map<
    string,
    ValueContext<string | number | undefined>
  >();
  private readonly info: Record<string, string | number | undefined> = {};
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
    this.ctx.registerCommand("auth.set", (e, platform, credentials, tokens) => {
      return this.set(platform, credentials, tokens);
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
      this.set(platform, result.credentials, result.tokens);
      this.setAuthInfo(platform, result.userId);
    }
  }
  private setAuthInfo(platform: string, userId: number | string | undefined) {
    this.info[platform] = userId;
    this.ctx.emit("auth:update", { platform, userId });
    if (!this.ctx.hasValue(`auth.userId.${platform}`)) {
      const valueCtx = this.ctx.registerValue(`auth.userId.${platform}`, {
        get: () => this.info[platform],
      });
      this.authValueContext.set(platform, valueCtx);
    } else {
      this.authValueContext.get(platform)?.emit(userId);
    }
  }
  /** 直接设置用户凭据 */
  set(platform: string, credentials: string, tokens?: Record<string, any>) {
    this.list.set(platform, { credentials, tokens });
    this.update(platform, credentials, tokens);
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
