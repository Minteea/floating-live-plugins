import {
  LiveRoom,
  LiveRoomData,
  LiveRoomStatus,
  PluginContext,
} from "floating-live";
import { createWriteStream, ensureDirSync } from "fs-extra";
import path from "path";

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
  // mode?: "json" | "msgpack";
}

type RecordRoomInfo = Partial<LiveRoomData> &
  Pick<LiveRoomData, "platform" | "id" | "status">;

/** 消息写入 */
export class MessageWriter implements SaveConfig {
  /** 前缀 */
  readonly prefix: string;
  /** 后缀 */
  readonly suffix: string;
  /** 当前文件可写流 */
  currentStream: NodeJS.WritableStream;
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
  readonly mode: "json" | "msgpack";
  /** 房间号 */
  readonly roomId: string | number;
  /** 时间戳 */
  timestamp: number;
  /** 状态 */
  status: LiveRoomStatus;
  /** 记录状态是否已更改 */
  statusChanged: boolean = false;
  /** 按状态分文件 */
  readonly sliceByStatus: boolean;
  /** 按消息记录数分文件 */
  sliceByCount: number;
  /** 消息记录数 */
  #count: number = 0;
  /** 总消息记录数 */
  totalCount: number = 0;
  /** 分块id */
  part: number;
  /** 当前文件路径 */
  #path: string;
  get path() {
    return this.#path;
  }
  constructor(
    roomInfo: RecordRoomInfo,
    { rootPath, sliceByStatus = false, sliceByCount = 0 }: SaveConfig
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
    ensureDirSync(rootPath);
    this.changeFile();
    this.currentStream.write(JSON.stringify(this.getRecordInfo(roomInfo)));
  }
  /** 分块 */
  slice() {
    this.#count = 0;
    this.part += 1;
    this.changeFile();
  }
  /** 按状态分块 */
  setStatus(status: LiveRoomStatus, timestamp: number) {
    if (!this.sliceByStatus) return;
    this.status = status;
    this.timestamp = timestamp || Date.now();
    this.statusChanged = true;
    this.#count = 0;
    this.part = 1;
    this.changeFile();
  }
  /** 切换文件 */
  changeFile() {
    const lastStream = this.currentStream;
    this.#path = path.join(this.rootPath, this.getFileId());
    this.currentStream = createWriteStream(
      path.join(
        this.rootPath,
        `${this.prefix}${this.getFileId()}${this.suffix}`
      ),
      {
        encoding: "utf8",
      }
    );
    lastStream?.end(JSON.stringify(this.getRecordSliceInfo()));
  }
  /** 写消息 */
  write(message: any) {
    this.currentStream.write(JSON.stringify(message) + ",");
    // 保存信息递增
    this.#count += 1;
    // 若单文件保存信息已达最大值，则切分到下一个文件
    if (this.sliceByCount && this.sliceByCount <= this.#count) this.slice();
  }
  getRecordInfo(roomInfo?: RecordRoomInfo) {
    return {
      type: "record",
      platform: this.platform,
      id: this.roomId,
      timestamp: this.timestamp,
      statusChanged: this.statusChanged,
      part: this.part,
      roomInfo: roomInfo,
    };
  }
  getRecordSliceInfo() {
    return {
      type: "record_slice",
      platform: this.platform,
      id: this.roomId,
      timestamp: this.timestamp,
      statusChanged: this.statusChanged,
      part: this.part,
    };
  }
  end() {
    this.currentStream.end();
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
    }
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
  write(
    message: any,
    { platform, room }: { platform: string; room: string | number }
  ) {
    if (this.paused) return;
    const roomKey = `${platform}:${room}`;
    // 获取消息写入器，若不存在则创建一个
    const writer =
      this.list.get(roomKey) || this.createWriter({ platform, room });
    writer.write(message);
  }
  start() {
    this.paused = false;
    this.getRoomList()
      .filter((room) => room.opened)
      .forEach(({ platform, id }) => this.createWriter({ platform, room: id }));
  }
  pause() {
    this.paused = true;
    this.clearWriter();
  }
  /** 创建消息写入实例 */
  createWriter({
    platform,
    room,
  }: {
    platform: string;
    room: string | number;
  }) {
    const info = this.getRoomData(`${platform}:${room}`) || {
      platform,
      id: room,
      status: LiveRoomStatus.off,
    };
    const saveInfoConfig = {
      rootPath: this.path,
      statusChanged: false,
      sliceByStatus: this.sliceByStatus,
      sliceByCount: this.sliceByCount,
    };
    const roomKey = `${platform}:${room}`;
    const writer = new MessageWriter(info, saveInfoConfig);
    this.list.set(roomKey, writer);
    return writer;
  }
  /** 移除消息写入实例 */
  removeWriter(roomKey: string) {
    this.list.get(roomKey)?.end();
    this.list.delete(roomKey);
  }
  clearWriter() {
    this.list.forEach((writer) => writer.end());
    this.list.clear();
  }
}

export default MsgSave;
