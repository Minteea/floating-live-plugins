import { RoomStatus } from "floating-live";
import { RoomInfo } from "floating-live";
import { FloatingLive } from "floating-live";
import MsgSave from "./msgSave";
import path from "node:path";

declare module "floating-live" {
  interface FloatingValueMap {
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

export class Save {
  static pluginName = "save";
  messageSave: MsgSave;
  rawSave: MsgSave;
  path: string;
  readonly main: FloatingLive;
  readonly rootPath: string;
  constructor(main: FloatingLive, config: PluginSaveOptions) {
    this.main = main;
    this.rootPath = path.resolve(config?.rootPath || ".");
    this.path = config.path || "";

    this.messageSave = new MsgSave(main, {
      filePath: this.path,
      sliceByStatus: true,
      open: !!config.message,
    });
    this.rawSave = new MsgSave(main, {
      filePath: this.path,
      suffix: ".raw",
      open: !!config.raw,
    });

    main.on("live:message", (msg) => {
      this.messageSave.write(msg, msg);
    });
    main.on("live:raw", (msg, { platform, room }) => {
      this.rawSave.write(msg, { platform, room });
    });
    // 直播状态改变时，更新保存信息
    main.on(
      "room:status",
      (
        roomKey: string,
        { status, timestamp }: { status: RoomStatus; timestamp?: number }
      ) => {
        const { platform, id } = main.room.get(roomKey)!.info;
        const saveInfo = {
          platform,
          room: id,
          status,
          timestamp: timestamp || 0,
          statusChanged: true,
        };
        this.messageSave.setSaveInfo(saveInfo);
        this.rawSave.setSaveInfo(saveInfo);
      }
    );
    // 打开直播间时，设置保存信息
    main.on("room:open", (roomKey: string, roomInfo: RoomInfo) => {
      const { platform, id, status } = roomInfo;
      const saveInfo = {
        platform,
        room: id,
        status,
        timestamp: Date.now(),
        statusChanged: false,
      };
      this.messageSave.setSaveInfo(saveInfo);
      this.rawSave.setSaveInfo(saveInfo);
    });
    // 关闭直播间时，移除保存信息
    main.on("room:close", (roomKey: string, roomInfo: RoomInfo) => {
      this.messageSave.removeSaveInfo(roomKey);
      this.rawSave.removeSaveInfo(roomKey);
    });

    main.value.register("save.message", {
      get: () => !this.messageSave.paused,
      set: (flag: boolean) => {
        this.setSaveMessage(flag);
      },
    });
    main.value.register("save.raw", {
      get: () => !this.rawSave.paused,
      set: (flag: boolean) => {
        this.setSaveRaw(flag);
      },
    });
    main.value.register("save.path", {
      get: () => this.path,
      set: (path: string) => this.setPath(path),
    });
  }
  setSaveMessage(flag: boolean) {
    flag ? this.messageSave.start() : this.messageSave.pause();
    this.main.value.emit("save.message", !this.messageSave.paused);
  }
  setSaveRaw(flag: boolean) {
    flag ? this.rawSave.start() : this.rawSave.pause();
    this.main.value.emit("save.raw", !this.rawSave.paused);
  }
  setPath(path: string) {
    this.path = path;
    this.updateFilePath();
    this.main.value.emit("save.path", path);
  }
  updateFilePath() {
    this.messageSave.path = path.resolve(this.rootPath, this.path);
    this.rawSave.path = path.resolve(this.rootPath, this.path);
    this.messageSave.list = new Map();
    this.rawSave.list = new Map();
  }
}

export default Save;
