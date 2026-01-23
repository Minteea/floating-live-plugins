import {
  LiveRoom,
  LiveRoomData,
  LiveRoomStatus,
  PluginContext,
} from "floating-live";
import { ensureDirSync } from "fs-extra";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { encode as encodeMsgpack } from "@msgpack/msgpack";
import {
  RecordRoomInfo,
  RecordEndInfo,
  RecordStartInfo,
  RecordEventInfo,
  RecordPartInfo,
} from "./types";

function getTimeStr(timestamp: number) {
  let startDate = new Date(timestamp);
  return `${startDate.getFullYear()}${(startDate.getMonth() + 1)
    .toString()
    .padStart(2, "0")}${startDate
    .getDate()
    .toString()
    .padStart(2, "0")}_${startDate
    .getHours()
    .toString()
    .padStart(2, "0")}${startDate
    .getMinutes()
    .toString()
    .padStart(2, "0")}${startDate.getSeconds().toString().padStart(2, "0")}`;
}
/** 获取当次记录状态
 * S=直播开始 L=直播中 E=直播结束 O=未开播
 */
function getRecordFlag(status?: LiveRoomStatus, statusChanged?: boolean) {
  if (status == LiveRoomStatus.live) {
    /** 已开播 */
    return statusChanged ? "S" : "L";
  } else {
    /** 未开播 */
    return statusChanged ? "E" : "O";
  }
}

interface SaveConfig {
  rootPath: string;
  sliceByStatus?: boolean;
  sliceByCount?: number;
  formatMode?: "jsonl" | "msgpack";
}

/** 消息写入 */
export abstract class MessageWriter implements SaveConfig {
  /** 后缀 */
  readonly suffix: string;
  /** 当前文件可写流 */
  currentStream!: NodeJS.WritableStream;
  /** 文件id */
  getFileId() {
    return `${this.platform}_${this.roomId}@${getTimeStr(this.timestamp || 0)}${
      this.sliceByStatus ? getRecordFlag(this.status, this.statusChanged) : ""
    }${this.part ? `.${this.part}` : ""}`;
  }
  /** 根目录 */
  readonly rootPath: string;
  /** 平台 */
  readonly platform: string;
  /** 记录模式 */
  abstract readonly formatMode: "jsonl" | "msgpack";
  /** 房间号 */
  readonly roomId: string | number;
  /** 时间戳 */
  timestamp: number;
  /** 状态 */
  status: LiveRoomStatus;
  /** 记录状态是否已更改 */
  statusChanged: boolean = false;
  /** 按状态分文件 */
  sliceByStatus: boolean;
  /** 按消息记录数分文件 */
  sliceByCount: number;
  /** 消息记录数 */
  #count: number = 0;
  /** 总消息记录数 */
  totalCount: number = 0;
  /** 分块id */
  part: number;
  /** 当前文件路径 */
  #path!: string;
  get path() {
    return this.#path;
  }
  get count() {
    return this.#count;
  }
  addCount() {
    this.#count += 1;
  }
  constructor(
    roomInfo: RecordRoomInfo,
    { rootPath, sliceByStatus = false, sliceByCount = 0 }: SaveConfig,
    { suffix = "" },
  ) {
    const { platform, id, status } = roomInfo;

    this.rootPath = rootPath;
    this.platform = platform;
    this.roomId = id;
    this.status = status;
    this.timestamp = Date.now();
    this.sliceByStatus = sliceByStatus;
    this.sliceByCount = sliceByCount;
    this.part = 1;

    this.suffix = suffix;

    ensureDirSync(rootPath);
    this.changeFile(roomInfo);
  }
  /** 分块 */
  slice() {
    this.#count = 0;
    this.part += 1;
    this.changeFile();
  }
  /** 重置信息状态，可用于按状态分块 */
  reset(newRoomInfo: RecordRoomInfo, { sliceByStatus = this.sliceByStatus }) {
    this.status = newRoomInfo.status;
    this.timestamp = newRoomInfo.timestamp || Date.now();
    this.statusChanged = true;
    this.#count = 0;
    this.part = 1;
    this.sliceByStatus = sliceByStatus;
    this.changeFile(newRoomInfo);
  }
  /** 切换文件 */
  changeFile(newRoomInfo?: RecordRoomInfo) {
    // 结束旧文件
    const lastStream = this.currentStream;
    lastStream?.end(
      newRoomInfo
        ? this.formatMessage(this.getRecordEndInfo("record:end"))
        : this.formatMessage(this.getRecordEndInfo("record:slice")),
    );

    // 写新文件
    this.#path = path.join(this.rootPath, this.getFileId());
    this.currentStream = createWriteStream(
      path.join(this.rootPath, `${this.getFileId()}${this.suffix}`),
      {
        encoding: this.formatMode === "msgpack" ? "binary" : "utf8",
      },
    );
    newRoomInfo
      ? this.currentStream.write(
          this.formatMessage(this.getRecordStartInfo(newRoomInfo)),
        )
      : this.currentStream.write(this.formatMessage(this.getRecordPartInfo()));
  }
  /** 写消息 */
  write(message: any): void {
    this.currentStream.write(this.formatMessage(message));
    // 保存信息递增
    this.addCount();
    // 若单文件保存信息已达最大值，则切分到下一个文件
    if (this.sliceByCount && this.sliceByCount <= this.count) this.slice();
  }

  /** 消息格式化 */
  abstract formatMessage(message: any): string | Uint8Array;

  /** 获取开始信息 */
  getRecordStartInfo(roomInfo?: RecordRoomInfo): RecordStartInfo {
    return {
      type: "record:start",
      platform: this.platform,
      roomId: this.roomId,
      timestamp: this.timestamp,
      status: this.status,
      statusChanged: this.statusChanged,
      part: this.part,
      room: roomInfo,
    };
  }
  /** 获取结束信息 */
  getRecordEndInfo(type: "record:slice" | "record:end"): RecordEndInfo {
    return {
      type,
      platform: this.platform,
      roomId: this.roomId,
      part: this.part,
    };
  }
  /** 获取事件信息 */
  getRecordEventInfo(
    type: "record:break" | "record:resume",
    message: string,
  ): RecordEventInfo {
    return {
      type,
      platform: this.platform,
      roomId: this.roomId,
      message,
    };
  }
  /** 获取切片信息 */
  getRecordPartInfo(): RecordPartInfo {
    return {
      type: "record:part",
      platform: this.platform,
      roomId: this.roomId,
      timestamp: this.timestamp,
      status: this.status,
      statusChanged: this.statusChanged,
      part: this.part,
    };
  }

  end() {
    this.currentStream.end();
  }
}

class JsonlWriter extends MessageWriter {
  readonly formatMode = "jsonl";
  formatMessage(message: any): string {
    return JSON.stringify(message) + "\n";
  }
}

class MsgpackWriter extends MessageWriter {
  readonly formatMode = "msgpack";
  formatMessage(message: any): Uint8Array {
    return encodeMsgpack(message);
  }
}

class MsgSave {
  /** 获取房间数据 */
  getRoomData: (key: string) => LiveRoomData | undefined;
  /** 获取房间列表 */
  getRoomList: () => LiveRoom[];
  /** 文件路径 */
  path: string;
  /** 前缀 */
  prefix: string;
  /** 后缀 */
  suffix: string;
  /** 按状态分文件 */
  sliceByStatus: boolean;
  /** 按消息数量分文件 */
  sliceByCount: number;
  /** 是否暂停 */
  paused: boolean;
  /** 列表 */
  list: Map<string, MessageWriter> = new Map();
  /** 格式 */
  #format: "jsonl" | "msgpack" = "jsonl";
  constructor(
    {
      getRoomData,
      getRoomList,
    }: {
      getRoomData: (key: string) => LiveRoomData | undefined;
      getRoomList: () => LiveRoom[];
    },
    {
      filePath,
      prefix = "",
      suffix = "",
      open = true,
      sliceByStatus = false,
      sliceByCount = 0,
    }: {
      filePath: string;
      prefix?: string;
      suffix?: string;
      open?: boolean;
      sliceByStatus?: boolean;
      sliceByCount?: number;
    },
  ) {
    this.paused = !open;
    this.getRoomData = getRoomData;
    this.getRoomList = getRoomList;
    this.path = filePath;
    this.prefix = prefix;
    this.suffix = suffix;
    this.sliceByStatus = sliceByStatus;
    this.sliceByCount = sliceByCount;
  }

  get format() {
    return this.#format;
  }

  changeFormat(format: "jsonl" | "msgpack") {
    this.#format = format;
    this.list.forEach((writer) => {});
  }

  write(
    message: any,
    { platform, roomId }: { platform: string; roomId: string | number },
  ) {
    if (this.paused) return;
    const roomKey = `${platform}:${roomId}`;
    // 获取消息写入器，若不存在则创建一个Unknown
    const writer =
      this.list.get(roomKey) ||
      this.createWriter({ platform, roomId }, this.format);
    writer.write(message);
  }

  /** 开始记录 */
  start() {
    this.paused = false;
    this.getRoomList()
      .filter((room) => room.opened)
      .forEach(({ platform, id }) =>
        this.createWriter({ platform, roomId: id }, this.format),
      );
  }
  /** 暂停记录 */
  pause() {
    this.paused = true;
    this.clearWriter();
  }
  /** 添加房间 */
  add({ platform, roomId }: { platform: string; roomId: string | number }) {
    this.createWriter({ platform, roomId }, this.format);
  }

  /** 移除消息写入实例 */
  remove(roomKey: string) {
    this.list.get(roomKey)?.end();
    this.list.delete(roomKey);
  }

  /** 重置实例 */
  updateStatus(roomKey: string, status: LiveRoomStatus, timestamp: number) {
    const writer = this.list.get(roomKey);
    if (writer) {
      const liveRoomData = this.getRoomData(roomKey) ?? {
        platform: writer?.platform,
        id: writer?.roomId,
        status,
        timestamp,
      };
      writer.reset(liveRoomData, { sliceByStatus: this.sliceByStatus });
    }
  }

  /** 创建消息写入实例 */
  createWriter(
    {
      platform,
      roomId,
    }: {
      platform: string;
      roomId: string | number;
    },
    mode: "jsonl" | "msgpack",
  ) {
    const info = this.getRoomData(`${platform}:${roomId}`) || {
      platform,
      id: roomId,
      status: LiveRoomStatus.off,
    };
    const saveInfoConfig = {
      rootPath: this.path,
      statusChanged: false,
      sliceByStatus: this.sliceByStatus,
      sliceByCount: this.sliceByCount,
    };
    const roomKey = `${platform}:${roomId}`;
    const writer =
      mode === "jsonl"
        ? new JsonlWriter(info, saveInfoConfig, {
            suffix: this.suffix + ".jsonl",
          })
        : new MsgpackWriter(info, saveInfoConfig, {
            suffix: this.suffix + ".msgpack",
          });
    this.list.set(roomKey, writer);
    return writer;
  }
  /** 清空所有消息写入实例 */
  clearWriter() {
    this.list.forEach((writer) => writer.end());
    this.list.clear();
  }
}

export default MsgSave;
