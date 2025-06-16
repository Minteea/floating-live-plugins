import { AppSnapshotMap, BasePlugin, LivePlatformInfo } from "floating-live";

declare module "floating-live" {
  interface AppEventDetailMap {
    "platform:register": { name: string; info: LivePlatformInfo };
    "platform:unregister": { name: string };
  }
  interface AppCommandMap {
    [name: `${string}.snapshot`]: () => any;
    snapshot: <K extends keyof AppSnapshotMap>(
      list: K[]
    ) => Pick<AppSnapshotMap, K>;
  }
}

export class PluginSnapshot extends BasePlugin {
  static pluginName = "snapshot";

  init() {
    this.ctx.registerCommand("snapshot", (e, list) => this.getSnapshots(list));
  }

  getSnapshots<K extends keyof AppSnapshotMap>(list: K[]) {
    const snapshots = {} as Pick<AppSnapshotMap, K>;
    list.forEach((k) => {
      try {
        snapshots[k] = this.getSnapshot(k);
      } catch {}
    });
    return snapshots;
  }

  getSnapshot<K extends keyof AppSnapshotMap>(k: K): AppSnapshotMap[K] {
    return this.ctx.call(`${k as string}.snapshot`);
  }
}

export default PluginSnapshot;
