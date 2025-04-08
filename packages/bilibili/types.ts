import { DanmakuMode, LiveRoomData } from "floating-live";

export interface BilibiliRoomData extends LiveRoomData {
  roomId: number;
  shortId: number;
}

export interface ConnectTokens {
  /** 用户uid */
  uid: number;
  /** buvid */
  buvid: string;
  /** 直播间key */
  key: string;
}

export interface RoomBaseInfo {
  room_id: number;
  uid: number;
  area_id: number;
  live_status: number;
  live_url: string;
  parent_area_id: number;
  title: string;
  parent_area_name: string;
  area_name: string;
  live_time: string;
  description: string;
  tags: string;
  attention: number;
  online: number;
  short_id: number;
  uname: string;
  cover: string;
  background: string;
  join_slide: number;
  live_id: number;
  live_id_str: string;
  lock_status: number;
  hidden_status: number;
  is_encrypted: boolean;
}
