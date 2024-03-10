import { RoomStatus } from "floating-live";
import { RoomInfo } from "floating-live";
import { FloatingLive } from "floating-live";
import MsgSave from "./msgSave";

export class SaveMessage {
  static pluginName = "saveMessage";
  constructor(ctx: FloatingLive) {
    const saveMessage = new MsgSave(ctx, {
      filePath: `./saves`,
      sliceByStatus: true,
    });
    // 直播状态改变时，更新保存信息
    ctx.on("room:status", (roomKey: string, { status, timestamp }) => {
      const { platform, id } = ctx.room.get(roomKey)!.info;
      saveMessage.setSaveInfo({
        platform,
        room: id,
        status,
        timestamp: timestamp || 0,
        statusChanged: true,
      });
    });
    // 打开直播间时，设置保存信息
    ctx.on("room:open", (roomKey: string, roomInfo: RoomInfo) => {
      const { platform, id, status } = roomInfo;
      saveMessage.setSaveInfo({
        platform,
        room: id,
        status,
        timestamp: Date.now(),
        statusChanged: false,
      });
    });
    // 关闭直播间时，移除保存信息
    ctx.on("room:close", (roomKey: string, roomInfo: RoomInfo) => {
      saveMessage.removeSaveInfo(roomKey);
    });
    ctx.on("live:message", (msg) => {
      saveMessage.write(msg, msg);
    });
    return saveMessage;
  }
}

export class SaveRaw {
  static pluginName = "saveRaw";
  constructor(ctx: FloatingLive) {
    const saveRaw = new MsgSave(ctx, {
      filePath: `./saves`,
      suffix: `.raw`,
    });
    // 打开直播间时，设置保存信息
    ctx.on("room:open", (roomKey: string, roomInfo: RoomInfo) => {
      const { platform, id, status } = roomInfo;
      saveRaw.setSaveInfo({
        platform,
        room: id,
        status,
        timestamp: Date.now(),
        statusChanged: false,
      });
    });
    // 关闭直播间时，移除保存信息
    ctx.on("room:close", (roomKey: string, roomInfo: RoomInfo) => {
      saveRaw.removeSaveInfo(roomKey);
    });
    ctx.on("live:raw", (msg, { platform, room }) => {
      saveRaw.write(msg, { platform, room });
    });
    saveRaw.start();
    return saveRaw;
  }
}
