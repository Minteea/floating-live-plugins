import {
  UserType,
  ImageSize,
  LiveRoomStatus,
  ImageInfo,
  LiveMessage,
  LiveRoomData,
  LiveRoomDetailInfo,
  UserInfo,
  LiveRoomStatsInfo,
} from "floating-live";
import {} from "floating-live";
// import { generateId } from "floating-live";
import { BilibiliRoomData, RoomBaseInfo } from "./types";

import { DataXliveGetInfoByRoom, MessageData } from "bilibili-live-danmaku";
type ParsingFunction<T extends MessageData.All> = {
  [K in T["cmd"]]: (
    msg: any,
    room?: LiveRoomData
  ) => LiveMessage.All | undefined;
};

// utils
const generateId = (m: LiveMessage.All) =>
  `${m.platform}:${m.roomId}-${m.type}:${m.userId}@${Date.now()}`;

// 获取当前时间戳，以替代无法从数据中获取时间戳的情况，精度为1s
function getDateTimestamp() {
  return Math.floor(Date.now() / 1000) * 1000;
}

const parsingFunction: ParsingFunction<MessageData.All> = {
  DANMU_MSG: (msg: MessageData.DANMU_MSG, room) => {
    const { info, msg_id } = msg;
    let content = info[1];
    let mode = info[0][1];
    let color = info[0][3];
    let uname = info[2][1];
    let uid = info[2][0];
    let timestamp = info[0][4];
    let guard_level = info[7]; // 舰长级别
    let extra = JSON.parse(info[0][15].extra);
    let medal =
      info[3][0] != null
        ? {
            level: info[3][0],
            name: info[3][1],
            // user: info[3][2],
            id: info[3][12],
            membership: info[3][10] || 0,
          }
        : null;
    let identity: null | UserType = 0;
    let emoticon: { [key: string]: ImageInfo } | undefined = undefined;
    if (extra.emots) {
      emoticon = {};
      for (let key in extra.emots) {
        let emotItem = extra.emots[key];
        emoticon[key] = {
          id: emotItem.emoticon_unique,
          url: emotItem.url,
          name: emotItem.emoji,
        };
      }
    }
    if (info[2][2]) {
      identity = UserType.admin;
    } else if (uid === room?.anchor.id) {
      identity = UserType.anchor;
    }
    let danmaku: LiveMessage.Comment = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: uid,
      type: "comment",
      timestamp: timestamp,
      id: msg_id!,
      info: {
        color: color,
        mode: mode,
        content: content,
        image: info[0][12]
          ? {
              name: content,
              id: info[0][13].emoticon_unique,
              url: info[0][13].url,
              size:
                info[0][13].width == info[0][13].height
                  ? ImageSize.large
                  : ImageSize.small,
            }
          : undefined,
        emoticon: emoticon,
        user: {
          name: uname,
          id: uid,
          medal: medal,
          membership: guard_level,
          type: identity,
        },
      },
    };
    danmaku.id ??= generateId(danmaku);
    return danmaku;
  },
  INTERACT_WORD: (msg: MessageData.INTERACT_WORD, room) => {
    const { data, msg_id, send_time } = msg;
    let type: "entry" | "follow" | "share";
    switch (data.msg_type) {
      case 1:
        type = "entry"; // 进入直播间
        break;
      case 2:
        type = "follow"; // 关注直播间
        break;
      case 3:
        type = "share"; // 分享直播间
        break;
      default:
        return;
    }
    let interact: LiveMessage.Interact = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: data.uid,
      type: type,
      id: msg_id!,
      timestamp: send_time || Math.floor(data.trigger_time / 1000000),
      info: {
        user: {
          name: data.uname,
          id: data.uid,
          medal: data.fans_medal?.medal_level
            ? {
                level: data.fans_medal.medal_level,
                name: data.fans_medal.medal_name,
                id: data.fans_medal.target_id,
                membership: data.fans_medal.guard_level,
              }
            : null,
        },
      },
    };
    interact.id ??= generateId(interact);
    return interact;
  },
  SEND_GIFT: (msg: MessageData.SEND_GIFT, room) => {
    const { data, msg_id, send_time } = msg;
    let gift: LiveMessage.Gift = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: data.uid,
      type: "gift",
      id: msg_id || data.combo_id,
      timestamp: send_time || data.timestamp * 1000,
      info: {
        user: {
          name: data.uname,
          id: data.uid,
          medal:
            data.fans_medal && data.fans_medal.medal_level
              ? {
                  level: data.fans_medal.medal_level,
                  name: data.fans_medal.medal_name,
                  id: data.fans_medal.target_id,
                  membership: data.fans_medal.guard_level,
                }
              : null,
          membership: data.guard_level,
          avatar: data.face,
        },
        gift: {
          name: data.giftName,
          id: data.giftId,
          num: data.num,
          value: data.total_coin,
          currency: data.coin_type,
          action: data.action,
          comboId: data.batch_combo_id,
        },
      },
    };
    gift.id ??= generateId(gift);
    return gift;
  },
  GUARD_BUY: (msg: MessageData.GUARD_BUY, room) => {
    const { data, msg_id, send_time } = msg;
    let gift: LiveMessage.Membership = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: data.uid,
      type: "membership",
      id: msg_id!,
      timestamp: send_time || data.start_time * 1000,
      info: {
        user: {
          name: data.username,
          id: data.uid,
          membership: data.guard_level,
        },
        gift: {
          name: data.gift_name,
          id: data.gift_id,
          num: data.num,
          value: data.price,
          currency: "gold",
        },
        name: data.gift_name,
        level: data.guard_level,
        duration: data.num * 30,
      },
    };
    gift.id ??= generateId(gift);
    return gift;
  },
  SUPER_CHAT_MESSAGE: (msg: MessageData.SUPER_CHAT_MESSAGE, room) => {
    const { data, msg_id, send_time } = msg;
    let sc: LiveMessage.Superchat = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: data.uid,
      type: "superchat",
      id: msg_id!,
      timestamp: send_time || data.ts * 1000,
      info: {
        id: data.id,
        user: {
          name: data.user_info.uname,
          id: data.uid,
          avatar: data.user_info.face,
          medal:
            data.medal_info && data.medal_info.medal_level
              ? {
                  level: data.medal_info.medal_level,
                  name: data.medal_info.medal_name,
                  id: data.medal_info.target_id,
                  membership: data.medal_info.guard_level,
                }
              : null,
          membership: data.user_info.guard_level,
        },
        content: data.message, // 文字
        color: data.background_bottom_color, // 颜色
        duration: data.time * 1000, // 持续时间(ms)
        gift: {
          id: data.gift.gift_id,
          name: data.gift.gift_name,
          num: data.gift.num,
          value: data.price * 1000, // 花费
          currency: "gold",
        },
      },
    };
    sc.id ??= generateId(sc);
    return sc;
  },
  WATCHED_CHANGE: (msg: MessageData.WATCHED_CHANGE, room) => {
    const { data, msg_id, send_time } = msg;
    const stats: LiveMessage.LiveStats = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: 0,
      type: "live_stats",
      id: msg_id!,
      timestamp: send_time || getDateTimestamp(),
      info: {
        view: data.num,
      },
    };
    stats.id ??= generateId(stats);
    return stats;
  },
  LIKE_INFO_V3_UPDATE: (msg: MessageData.LIKE_INFO_V3_UPDATE, room) => {
    const { data, msg_id, send_time } = msg;
    const stats: LiveMessage.LiveStats = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: 0,
      type: "live_stats",
      id: msg_id!,
      timestamp: send_time || getDateTimestamp(),
      info: {
        like: data.click_count,
      },
    };
    stats.id ??= generateId(stats);
    return stats;
  },
  ONLINE_RANK_COUNT: (msg: MessageData.ONLINE_RANK_COUNT, room) => {
    const { data, msg_id, send_time } = msg;
    if (data.online_count == null) return;
    const stats: LiveMessage.LiveStats = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: 0,
      type: "live_stats",
      id: msg_id!,
      timestamp: send_time || getDateTimestamp(),
      info: {
        online: data.online_count,
      },
    };
    stats.id ??= generateId(stats);
    return stats;
  },
  ROOM_BLOCK_MSG: (msg: MessageData.ROOM_BLOCK_MSG, room) => {
    const { data, msg_id, send_time } = msg;
    const block: LiveMessage.Block = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: data.uid,
      type: "block",
      id: msg_id!,
      timestamp: send_time || getDateTimestamp(),
      info: {
        user: {
          id: data.uid,
          name: data.uname,
        },
        operator: {
          type: data.operator == 2 ? UserType.anchor : UserType.admin,
        },
      },
    };
    block.id ??= generateId(block);
    return block;
  },
  LIVE: (msg: MessageData.LIVE, room) => {
    const { msg_id, send_time } = msg;
    // 直播间开播
    if (msg.live_time) {
      let live: LiveMessage.LiveStart = {
        platform: "bilibili",
        roomId: room?.id || 0,
        userId: 0,
        type: "live_start",
        id: msg_id!,
        timestamp: send_time || msg.live_time * 1000,
        info: {
          id: msg.live_key.toString(),
        },
      };
      live.id ??= generateId(live);
      return live;
    }
  },
  CUT_OFF: (msg: MessageData.CUT_OFF, room) => {
    const { msg_id, send_time } = msg;
    // 直播间被切断
    let cut: LiveMessage.LiveCut = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: 0,
      type: "live_cut",
      id: msg_id!,
      timestamp: send_time || getDateTimestamp(),
      info: {
        message: msg.msg,
      },
    };
    cut.id ??= generateId(cut);
    return cut;
  },
  PREPARING: (msg: MessageData.PREPARING, room) => {
    const { msg_id, send_time } = msg;
    let off: LiveMessage.LiveEnd = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: 0,
      type: "live_end",
      id: msg_id!,
      timestamp: send_time || getDateTimestamp(),
      info: {
        status: msg.round ? LiveRoomStatus.round : LiveRoomStatus.off,
      },
    };
    off.id ??= generateId(off);
    return off;
  },
  ROOM_CHANGE: (msg: MessageData.ROOM_CHANGE, room) => {
    const { data, msg_id, send_time } = msg;
    let change: LiveMessage.LiveDetail = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: 0,
      type: "live_detail",
      id: msg_id!,
      timestamp: send_time || getDateTimestamp(),
      info: {
        title: data.title,
        area: [data.parent_area_name, data.area_name],
      },
    };
    change.id ??= generateId(change);
    return change;
  },
  ANCHOR_LOT_START: (msg: MessageData.ANCHOR_LOT_START, room) => {
    const { data, msg_id, send_time } = msg;
    let m: LiveMessage.Lottery = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: 0,
      type: "lottery",
      timestamp: send_time || data.current_time * 1000,
      id: msg_id!,
      info: {
        id: data.id,
        award: {
          name: data.award_name,
          num: data.award_num,
          image: data.award_image,
          id: -1,
          value: 0,
          currency: "",
        },
      },
    };
    return m;
  },
};

/** 转换bilibili直播弹幕为floating通用格式 */
export function parseMessage(
  data: MessageData.All,
  room?: BilibiliRoomData
): LiveMessage.All | undefined {
  return parsingFunction[data.cmd]?.(data, room);
}

/** 转换bilibili直播间信息为floating通用格式 */
export function parseGetInfoByRoom(
  data: DataXliveGetInfoByRoom
): BilibiliRoomData {
  const {
    room_info,
    anchor_info,
    like_info_v3,
    watched_show,
  }: DataXliveGetInfoByRoom = data;
  return {
    platform: "bilibili",
    id: room_info.room_id,
    roomId: room_info.room_id,
    shortId: room_info.short_id,
    key: `bilibili:${room_info.room_id}`,
    detail: {
      title: room_info.title,
      area: [room_info.parent_area_name, room_info.area_name],
      cover: room_info.cover,
    },
    anchor: {
      id: room_info.uid,
      name: anchor_info.base_info.uname,
      avatar: anchor_info.base_info.face,
    },
    stats: {
      view: watched_show.num,
      like: like_info_v3.total_likes,
    },
    liveId: room_info.live_id_str,
    available: room_info.lock_status ? false : true,
    status: room_info.lock_status
      ? LiveRoomStatus.banned
      : (room_info.live_status as LiveRoomStatus),
    timestamp:
      room_info.live_status == LiveRoomStatus.live
        ? room_info.live_start_time * 1000
        : 0,
    openStatus: 0,
    opened: false,
    connectionStatus: 0,
  };
}

/** 转换bilibili直播间信息为floating通用格式 */
export function parseRoomBaseInfo(data: RoomBaseInfo): BilibiliRoomData {
  return {
    platform: "bilibili",
    id: data.room_id,
    roomId: data.room_id,
    shortId: data.short_id,
    key: `bilibili:${data.room_id}`,
    detail: {
      title: data.title,
      area: [data.parent_area_name, data.area_name],
      cover: data.cover,
    },
    anchor: {
      id: data.uid,
      name: data.uname,
    },
    stats: {},
    liveId: data.live_id_str,
    available: data.lock_status ? false : true,
    status: data.lock_status
      ? LiveRoomStatus.banned
      : (data.live_status as LiveRoomStatus),
    timestamp:
      data.live_status == LiveRoomStatus.live
        ? new Date(`${data.live_time} GMT+0800`).getTime() * 1000
        : 0,
    openStatus: 0,
    opened: false,
    connectionStatus: 0,
  };
}

export function mergeLiveRoomData<T extends LiveRoomData>(
  ...list: Partial<T>[]
): T {
  const room: Partial<LiveRoomData> = Object.assign({}, ...list);
  const detail: LiveRoomDetailInfo = Object.assign(
    {},
    ...list.map((d) => d.detail)
  );
  const anchor: UserInfo = Object.assign({}, ...list.map((d) => d.anchor));
  const stats: LiveRoomStatsInfo = Object.assign(
    {},
    ...list.map((d) => d.stats)
  );
  return { ...room, detail, anchor, stats } as T;
}
