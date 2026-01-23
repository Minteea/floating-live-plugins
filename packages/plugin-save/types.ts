import { LiveRoomData, LiveRoomStatus } from "floating-live";

export type RecordRoomInfo = Partial<LiveRoomData> &
  Pick<LiveRoomData, "platform" | "id" | "status">;

/** 录制开始信息 */
export interface RecordStartInfo {
  type: "record:start";
  platform: string;
  roomId: string | number;
  timestamp: number;
  status: LiveRoomStatus;
  statusChanged: boolean;
  part: number;
  room?: RecordRoomInfo;
}

/** 录制切片开头信息 */
export interface RecordPartInfo {
  type: "record:part";
  platform: string;
  roomId: string | number;
  timestamp: number;
  status: LiveRoomStatus;
  statusChanged: boolean;
  part: number;
}

/** 录制文件结束信息 */
export interface RecordEndInfo {
  type: "record:slice" | "record:end";
  platform: string;
  roomId: string | number;
  part: number;
}

/** 录制文件事件信息（断开/恢复） */
export interface RecordEventInfo {
  type: "record:break" | "record:resume";
  platform: string;
  roomId: string | number;
  message: string;
}
