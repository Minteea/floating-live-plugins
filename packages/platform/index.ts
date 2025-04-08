import { BasePlugin, LivePlatformInfo } from "floating-live";

interface PluginExposes {
  register(name: string, info: LivePlatformInfo, signal: AbortSignal): void;
  get(name: string): LivePlatformInfo | undefined;
  toData(): { name: string }[];
}

declare module "floating-live" {
  interface AppPluginExposesMap {
    platform: PluginExposes;
  }
}

export class PluginPlatform extends BasePlugin {
  static pluginName = "platform";
  private list = new Map<string, LivePlatformInfo>();

  /** 注册直播平台信息 */
  register(name: string, info: LivePlatformInfo, signal?: AbortSignal) {
    if (this.list.has(name)) {
      throw new this.Error("platform:register_duplicated", {
        message: "平台信息重复注册",
      });
    }
    this.list.set(name, info);
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          this.unregister(name);
        },
        { once: true }
      );
    }
  }
  /** 解除注册直播平台信息 */
  unregister(name: string) {
    if (!this.list.has(name)) {
      throw new this.Error("platform:unregister_unexisted", {
        message: "无法解除不存在的平台信息注册",
      });
    }
    this.list.delete(name);
  }
  /** 获取直播平台信息 */
  get(name: string): LivePlatformInfo | undefined {
    return this.list.get(name);
  }

  expose(): PluginExposes {
    return {
      register: (name: string, info: LivePlatformInfo, signal: AbortSignal) => {
        this.register(name, info, signal);
      },
      get: (name: string) => this.get(name),
      toData: () => this.toData(),
    };
  }

  toData() {
    return [...this.list].map(([name, info]) => ({ name, info }));
  }
}

export default PluginPlatform;
