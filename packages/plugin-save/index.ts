import {
  type FloatingLive,
  type LiveRoomStatus,
  type LiveRoomData,
  BasePlugin,
  PluginContext,
  AppPluginExposesMap,
  ValueContext,
} from "floating-live";
import MsgWriter from "./msgWriter";
import path from "node:path";

declare module "floating-live" {
  interface AppValueMap {
    "save.message": boolean;
    "save.raw": boolean;
    "save.path": string;
  }
}

interface PluginSaveOptions {
  message?: boolean;
  raw?: boolean;
  path?: string;
  rootPath?: string;
}

export class Save extends BasePlugin {
  static pluginName = "save";
  messageSave: MsgWriter;
  rawSave: MsgWriter;
  path: string;
  room: AppPluginExposesMap["room"] | null = null;
  private valueContexts: {
    message: ValueContext<boolean>;
    raw: ValueContext<boolean>;
    path: ValueContext<string>;
  };
  readonly rootPath: string;
  constructor(ctx: PluginContext, config: PluginSaveOptions) {
    super(ctx);
    this.rootPath = path.resolve(config?.rootPath || ".");
    this.path = config.path || "";

    ctx.whenRegister("room", (room) => {
      this.room = room;
      return () => {
        this.room = null;
      };
    });

    this.messageSave = new MsgWriter(
      {
        getRoomData: (key) => this.room?.data(key),
        getRoomList: () => this.room?.getList() || [],
      },
      {
        filePath: path.resolve(this.rootPath, this.path),
        suffix: ".rec",
        sliceByStatus: true,
        open: !!config.message,
      },
    );
    this.rawSave = new MsgWriter(
      {
        getRoomData: (key) => this.room?.data(key),
        getRoomList: () => this.room?.getList() || [],
      },
      {
        filePath: path.resolve(this.rootPath, this.path),
        suffix: ".raw",
        sliceByStatus: true,
        open: !!config.raw,
      },
    );

    ctx.on("live:message", ({ message: msg }) => {
      this.messageSave.write(msg, msg);
    });
    ctx.on("live:raw", ({ platform, roomId, data }) => {
      this.rawSave.write(data, { platform, roomId });
    });
    // 直播状态改变时，更新保存器状态信息
    ctx.on("room:status", ({ status, timestamp, key }) => {
      this.messageSave.updateStatus(key, status, timestamp);
      this.rawSave.updateStatus(key, status, timestamp);
    });
    // 打开直播间时，添加保存器实例
    ctx.on("room:open", ({ room }) => {
      const { platform, id, status } = room;
      const saveInfo = {
        platform,
        roomId: id,
        status,
        timestamp: Date.now(),
        statusChanged: false,
      };
      this.messageSave.add(saveInfo);
      this.rawSave.add(saveInfo);
    });
    // 关闭直播间时，移除保存器实例
    ctx.on("room:close", ({ key }) => {
      this.messageSave.remove(key);
      this.rawSave.remove(key);
    });

    this.valueContexts = {
      message: ctx.registerValue("save.message", {
        get: () => !this.messageSave.paused,
        set: (flag: boolean) => {
          this.setSaveMessage(flag);
        },
      }),
      raw: ctx.registerValue("save.raw", {
        get: () => !this.rawSave.paused,
        set: (flag: boolean) => {
          this.setSaveRaw(flag);
        },
      }),
      path: ctx.registerValue("save.path", {
        get: () => this.path,
        set: (path: string) => this.setPath(path),
      }),
    };
  }
  setSaveMessage(flag: boolean) {
    flag ? this.messageSave.start() : this.messageSave.pause();
    this.valueContexts.message.emit(!this.messageSave.paused);
  }
  setSaveRaw(flag: boolean) {
    flag ? this.rawSave.start() : this.rawSave.pause();
    this.valueContexts.raw.emit(!this.rawSave.paused);
  }
  setPath(path: string) {
    this.path = path;
    this.updateFilePath();
    this.valueContexts.path.emit(path);
  }
  updateFilePath() {
    this.messageSave.path = path.resolve(this.rootPath, this.path);
    this.rawSave.path = path.resolve(this.rootPath, this.path);
    this.messageSave.list = new Map();
    this.rawSave.list = new Map();
  }
}

export default Save;
