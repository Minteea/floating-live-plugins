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
  DanmakuMode,
} from "floating-live";
import { } from "floating-live";
// import { generateId } from "floating-live";
import { BilibiliRoomData, RoomBaseInfo } from "./types";
import { LiveEventMap } from "@laplace.live/ws";
import { BilibiliInternal } from "@laplace.live/internal";

import { decode_INTERACT_WORD_V2, decode_ONLINE_RANK_V3 } from "./decoder";
import { DataXliveGetInfoByRoom, MessageData } from "bilibili-live-danmaku";

type ParsingFunction = {
  [key: string]: (
    msg: any,
    room?: LiveRoomData,
  ) => LiveMessage.All | undefined;
};

// utils
/** @deprecated Use generateIdByTimestamp or generateIdByValue instead */
const generateId = (m: LiveMessage.All) =>
  `${m.platform}:${m.roomId}-${m.type}:${m.userId}~${Date.now()}`;

const generateIdByTimestamp = (m: LiveMessage.All) =>
  `${m.platform}:${m.roomId}-${m.type}:${m.userId}@${m.timestamp}`;

const generateIdByValue = (m: LiveMessage.All, id: string) =>
  `${m.platform}:${m.roomId}-${m.type}:${m.userId}@${id}`;

// 获取当前时间戳，以替代无法从数据中获取时间戳的情况，精度为1s
function getDateTimestamp() {
  return Math.floor(Date.now() / 1000) * 1000;
}

const parsingFunction: ParsingFunction = {
  DANMU_MSG: (msg: BilibiliInternal.WebSocket.Prod.DANMU_MSG, room) => {
    const { info, msg_id } = msg;
    const content = info[1];
    const mode = info[0][1];
    const color = info[0][3];
    const uname = info[2][1];
    const uid = info[2][0];
    const timestamp = info[0][4];
    const guard_level = info[7]; // 舰长级别
    const emote = info[0][12] ? info[0][13] as BilibiliInternal.WebSocket.Prod.EmoteProps : undefined;
    const extra: BilibiliInternal.WebSocket.Prod.ExtraMeta = JSON.parse(info[0][15].extra);
    const medal =
      info[3]?.[0] != null
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
      id: "",
      data: {
        color: color,
        mode: mode as DanmakuMode,
        content: content,
        image: emote
          ? {
            name: content,
            id: emote.emoticon_unique,
            url: emote.url,
            size:
              emote.width == emote.height
                ? ImageSize.large
                : ImageSize.small,
          }
          : undefined,
        emoticon: emoticon,
        user: {
          name: uname,
          id: uid,
          avatar: info[0][15].user?.base?.face,
          medal: medal,
          membership: guard_level,
          type: identity,
        },
      },
    };
    danmaku.id = generateIdByTimestamp(danmaku);
    return danmaku;
  },

  INTERACT_WORD_V2: (msg: BilibiliInternal.WebSocket.Prod.INTERACT_WORD_V2, room) => {
    const pb = msg.data.pb;

    const data = decode_INTERACT_WORD_V2(pb);


    let type: "entry" | "follow" | "share";
    switch (Number(data.msgType)) {
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
      userId: Number(data.uid),
      type: type,
      id: "",
      timestamp:
        Math.floor(Number(data.triggerTime || 0) / 1000000),
      data: {
        user: {
          name: data.uname!,
          id: Number(data.uid),
          avatar: data.uinfo?.base?.face!,
          medal: data.fansMedal?.medalLevel
            ? {
              level: Number(data.fansMedal.medalLevel),
              name: data.fansMedal.medalName!,
              id: Number(data.fansMedal.targetId),
              membership: Number(data.fansMedal.guardLevel),
            }
            : null,
        },
      },
    };
    interact.id ??= generateIdByTimestamp(interact);
    return interact;
  },

  LIKE_INFO_V3_CLICK: (msg: BilibiliInternal.WebSocket.Prod.LIKE_INFO_V3_CLICK, room) => {
    const { data } = msg;
    let like: LiveMessage.Interact = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: data.uid,
      type: "like",
      id: "",
      timestamp: getDateTimestamp(),
      data: {
        user: {
          name: data.uname,
          id: data.uid,
          avatar: data.uinfo?.base?.face,
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
    like.id ??= generateId(like);
    return like;
  },
  SEND_GIFT: (msg: BilibiliInternal.WebSocket.Prod.SEND_GIFT, room) => {
    const { data } = msg;
    const medal = data.medal_info;
    let gift: LiveMessage.Gift = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: data.uid,
      type: "gift",
      id: "",
      timestamp: data.timestamp * 1000,
      data: {
        user: {
          name: data.uname,
          id: data.uid,
          medal:
            medal && medal.medal_level
              ? {
                level: medal.medal_level,
                name: medal.medal_name,
                id: medal.target_id,
                membership: medal.guard_level,
              }
              : null,
          membership: data.guard_level,
          avatar: data.face,
        },
        gift: {
          image: data.gift_info.img_basic,
          name: data.giftName,
          id: data.giftId,
          num: data.num,
          value: data.total_coin,
          valueType: data.coin_type,
          coins:
            data.coin_type == "gold" ? data.total_coin / 100 : data.total_coin,
          coinName: data.coin_type == "gold" ? "电池" : "银瓜子",
          price: data.coin_type == "gold" ? data.total_coin / 1000 : 0,
          currency: "CNY",
          action: data.action,
          comboId: data.batch_combo_id,
        },
      },
    };
    gift.id ??= generateIdByValue(gift, data.rnd);
    return gift;
  },
  /** @deprecated Use USER_TOAST_MSG_V2 instead */
  USER_TOAST_MSG: (msg: BilibiliInternal.WebSocket.Prod.USER_TOAST_MSG, room) => {
    return undefined;
    const { data } = msg;
    let gift: LiveMessage.Membership = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: data.uid,
      type: "membership",
      id: "",
      timestamp: data.start_time * 1000,
      data: {
        user: {
          // avatar: "",
          name: data.username,
          id: data.uid,
        },
        gift: {
          name: data.role_name,
          id: data.gift_id,
          num: data.num,
          value: data.price,
          valueType: "gold",
          coins: data.price / 100,
          coinName: "电池",
          price: data.price / 1000,
          currency: "CNY",
          unit:
            data.unit == "年" ? "year" : data.unit == "天" ? "day" : "month",
        },
        name: data.role_name,
        level: data.guard_level,
        duration:
          data.num *
          (data.unit == "年" ? 365 : data.unit == "天" ? 1 : 30) *
          24 *
          3600_000,
      },
    };
    gift.id ??= generateId(gift);
    return gift;
  },
  USER_TOAST_MSG_V2: (msg: BilibiliInternal.WebSocket.Prod.USER_TOAST_MSG_V2, room) => {
    const { data } = msg;
    const user = data.sender_uinfo;
    const num = data.pay_info.num;
    let gift: LiveMessage.Membership = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: user.uid,
      type: "membership",
      id: "",
      timestamp: data.guard_info.start_time * 1000,
      data: {
        user: {
          // avatar: "",
          name: user.base.name,
          id: user.uid,
        },
        gift: {
          name: data.guard_info.role_name,
          id: data.gift_info.gift_id,
          num: num,
          value: data.pay_info.price,
          valueType: "gold",
          coins: data.pay_info.price / 100,
          coinName: "电池",
          price: data.pay_info.price / 1000,
          currency: "CNY",
          unit:
            data.pay_info.unit == "年" ? "year" : data.pay_info.unit == "天" ? "day" : "month",
        },
        name: data.guard_info.role_name,
        level: data.guard_info.guard_level,
        duration:
          num *
          (data.pay_info.unit == "年" ? 365 : data.pay_info.unit == "天" ? 1 : 30) *
          24 *
          3600_000,
      },
    };
    gift.id ??= generateIdByValue(gift, data.pay_info.payflow_id);
    return gift;
  },
  SUPER_CHAT_MESSAGE: (msg: BilibiliInternal.WebSocket.Prod.SUPER_CHAT_MESSAGE, room) => {
    const { data } = msg;
    let sc: LiveMessage.Superchat = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: data.uid,
      type: "superchat",
      id: "",
      timestamp: data.ts * 1000,
      data: {
        token: data.token,
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
          value: data.price * 1000,
          valueType: "gold",
          coins: data.price * 10,
          coinName: "电池",
          price: data.price,
          currency: "CNY",
        },
      },
    };
    sc.id ??= generateIdByValue(sc, data.token);
    return sc;
  },
  WATCHED_CHANGE: (msg: BilibiliInternal.WebSocket.Prod.WATCHED_CHANGE, room) => {
    const { data } = msg;
    const stats: LiveMessage.LiveStats = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: 0,
      type: "live_stats",
      id: "",
      timestamp: getDateTimestamp(),
      data: {
        view: data.num,
      },
    };
    stats.id ??= generateId(stats);
    return stats;
  },
  LIKE_INFO_V3_UPDATE: (msg: BilibiliInternal.WebSocket.Prod.LIKE_INFO_V3_UPDATE, room) => {
    const { data } = msg;
    const stats: LiveMessage.LiveStats = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: 0,
      type: "live_stats",
      id: "",
      timestamp: getDateTimestamp(),
      data: {
        like: data.click_count,
      },
    };
    stats.id ??= generateId(stats);
    return stats;
  },
  ROOM_REAL_TIME_MESSAGE_UPDATE: (msg: BilibiliInternal.WebSocket.Prod.ROOM_REAL_TIME_MESSAGE_UPDATE, room) => {
    const { data } = msg;
    const stats: LiveMessage.LiveStats = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: 0,
      type: "live_stats",
      id: "",
      timestamp: getDateTimestamp(),
      data: {
        fans: data.fans,
        clubFans: data.fans_club
      },
    };
    stats.id ??= generateId(stats);
    return stats;
  },
  ONLINE_RANK_COUNT: (msg: BilibiliInternal.WebSocket.Prod.ONLINE_RANK_COUNT, room) => {
    const { data } = msg;
    if (data.online_count == null) return;
    const stats: LiveMessage.LiveStats = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: 0,
      type: "live_stats",
      id: "",
      timestamp: getDateTimestamp(),
      data: {
        online: data.online_count,
      },
    };
    stats.id ??= generateId(stats);
    return stats;
  },
  ROOM_BLOCK_MSG: (msg: BilibiliInternal.WebSocket.Prod.ROOM_BLOCK_MSG, room) => {
    const { data } = msg;
    const block: LiveMessage.Block = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: data.uid,
      type: "block",
      id: "",
      timestamp: getDateTimestamp(),
      // expired: data.block_expired ? data.block_expired * 1000 : undefined,
      data: {
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
  LIVE: (msg: BilibiliInternal.WebSocket.Prod.LIVE, room) => {
    // 直播间开播
    if (msg.live_time) {
      let live: LiveMessage.LiveStart = {
        platform: "bilibili",
        roomId: room?.id || 0,
        userId: 0,
        type: "live_start",
        id: "",
        timestamp: msg.live_time * 1000,
        data: {
          id: msg.live_key.toString(),
        },
      };
      live.id ??= generateIdByValue(live, live.data.id);
      return live;
    }
  },
  CUT_OFF: (msg: BilibiliInternal.WebSocket.Prod.CUT_OFF, room) => {
    // 直播间被切断
    let cut: LiveMessage.LiveCut = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: 0,
      type: "live_cut",
      id: "",
      timestamp: getDateTimestamp(),
      data: {
        message: msg.msg,
        status: LiveRoomStatus.off,
      },
    };
    cut.id ??= generateId(cut);
    return cut;
  },
  PREPARING: (msg: BilibiliInternal.WebSocket.Prod.PREPARING & { send_time?: number, round: any }, room) => {
    const { send_time } = msg;
    let off: LiveMessage.LiveEnd = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: 0,
      type: "live_end",
      id: "",
      timestamp: send_time || getDateTimestamp(),
      data: {
        status: msg.round ? LiveRoomStatus.round : LiveRoomStatus.off,
      },
    };
    off.id ??= generateIdByTimestamp(off);
    return off;
  },
  ROOM_CHANGE: (msg: BilibiliInternal.WebSocket.Prod.ROOM_CHANGE, room) => {
    const { data } = msg;
    let change: LiveMessage.LiveDetail = {
      platform: "bilibili",
      roomId: room?.id || 0,
      userId: 0,
      type: "live_detail",
      id: "",
      timestamp: getDateTimestamp(),
      data: {
        title: data.title,
        area: [data.parent_area_name, data.area_name],
      },
    };
    change.id ??= generateId(change);
    return change;
  },
  // ANCHOR_LOT_START: (msg: BilibiliInternal.WebSocket.Prod.ANCHOR_LOT_START, room) => {
  //   const { data } = msg;
  //   let m: LiveMessage.Lottery = {
  //     platform: "bilibili",
  //     roomId: room?.id || 0,
  //     userId: 0,
  //     type: "lottery",
  //     timestamp: send_time || data.current_time * 1000,
  //     id: msg_id!,
  //     data: {
  //       id: data.id,
  //       award: {
  //         name: data.award_name,
  //         num: data.award_num,
  //         image: data.award_image,
  //         id: -1,
  //         value: 0,
  //         currency: "",
  //       },
  //     },
  //   };
  //   return m;
  // },
};

/** 转换bilibili直播弹幕为floalive通用格式 */
export function parseMessage(
  data: MessageData.All,
  room?: BilibiliRoomData,
): LiveMessage.All | undefined {
  return parsingFunction[data.cmd]?.(data, room);
}

/** 转换bilibili直播间信息为floalive通用格式 */
export function parseGetInfoByRoom(
  data: DataXliveGetInfoByRoom,
): BilibiliRoomData {
  const {
    room_info,
    anchor_info,
    like_info_v3,
    watched_show,
  }: DataXliveGetInfoByRoom = data;
  return {
    platform: "bilibili",
    service: "bilibili",
    id: room_info.room_id,
    roomId: room_info.room_id,
    shortId: room_info.short_id,
    key: `bilibili:${room_info.room_id}`,
    pending: false,
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
    valid: true,
  };
}

/** 转换bilibili直播间信息为floalive通用格式 */
export function parseRoomBaseInfo(data: RoomBaseInfo): BilibiliRoomData {
  return {
    platform: "bilibili",
    service: "bilibili",
    id: data.room_id,
    roomId: data.room_id,
    shortId: data.short_id,
    key: `bilibili:${data.room_id}`,
    pending: false,
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
    valid: true,
  };
}

export function mergeLiveRoomData<T extends LiveRoomData>(
  ...list: Partial<T>[]
): T {
  const room: Partial<LiveRoomData> = Object.assign({}, ...list);
  const detail: LiveRoomDetailInfo = Object.assign(
    {},
    ...list.map((d) => d.detail),
  );
  const anchor: UserInfo = Object.assign({}, ...list.map((d) => d.anchor));
  const stats: LiveRoomStatsInfo = Object.assign(
    {},
    ...list.map((d) => d.stats),
  );
  return { ...room, detail, anchor, stats } as T;
}
