import {
  GiftInfo,
  MedalInfo,
  LiveMessage,
  LiveRoomData,
  LiveRoomStatus,
  UserInfo,
  UserType,
} from "floating-live";
import { GiftList, RawMessage } from "./types";

// utils
const generateId = (m: LiveMessage.All) =>
  `${m.platform}:${m.roomId}-${m.type}:${m.userId}@${Date.now()}-${(
    Math.random() * 0x10000
  )
    .toString(16)
    .padStart(4, "0")}`;

type ParsingFunction = {
  [K in keyof MessageTypes]: (
    data: MessageTypes[K],
    room?: LiveRoomData,
    giftList?: GiftList
  ) => LiveMessage.All | undefined;
};

interface MessageTypes {
  CommonActionSignalComment: RawMessage.CommonActionSignalComment;
  CommonActionSignalGift: RawMessage.CommonActionSignalGift;
  CommonActionSignalUserEnterRoom: RawMessage.CommonActionSignalUserEnterRoom;
  CommonActionSignalUserFollowAuthor: RawMessage.CommonActionSignalUserFollowAuthor;
  CommonActionSignalLike: RawMessage.CommonActionSignalLike;
  AcfunActionSignalJoinClub: RawMessage.AcfunActionSignalJoinClub;
  CommonStateSignalDisplayInfo: RawMessage.CommonStateSignalDisplayInfo;
  ZtLiveScStatusChanged: RawMessage.ZtLiveScStatusChanged;
}

/** 获取当前时间戳，以替代无法从数据中获取时间戳的情况，精度为1s */
function getDateTimestamp(): number {
  return Math.floor(Date.now() / 1000) * 1000;
}

/** 将带单位数值转换为纯数字 */
function stringToNumber(num: string) {
  if (num.slice(-1) == "万") {
    return Math.round(parseFloat(num) * 10000);
  } else {
    return parseFloat(num);
  }
}

const parsingFunction: ParsingFunction = {
  CommonActionSignalComment: (data, room) => {
    const msg: LiveMessage.Comment = {
      platform: "acfun",
      roomId: room?.id || 0,
      userId: 0,
      id: "",
      timestamp: parseInt(data.sendTimeMs),
      type: "comment",
      info: {
        content: data.content,
        user: getUserInfo(data.userInfo),
      },
    };
    msg.id = generateId(msg);
    msg.userId = msg.info.user.id;
    return msg;
  },
  CommonActionSignalGift: (data, room, giftList) => {
    const msg: LiveMessage.Gift = {
      platform: "acfun",
      roomId: room?.id || 0,
      userId: 0,
      id: "",
      type: "gift",
      timestamp: parseInt(data.sendTimeMs),
      info: {
        user: getUserInfo(data.userInfo),
        gift: getGiftInfo(data, giftList),
      },
    };
    msg.id = generateId(msg);
    msg.userId = msg.info.user.id;
    return msg;
  },
  CommonActionSignalUserEnterRoom: (data, room) => {
    const msg: LiveMessage.Interact = {
      platform: "acfun",
      roomId: room?.id || 0,
      userId: 0,
      type: "entry",
      id: "",
      timestamp: parseInt(data.sendTimeMs),
      info: {
        user: getUserInfo(data.userInfo),
      },
    };
    msg.id = generateId(msg);
    msg.userId = msg.info.user.id;
    return msg;
  },
  CommonActionSignalUserFollowAuthor: (data, room) => {
    const msg: LiveMessage.Interact = {
      platform: "acfun",
      roomId: room?.id || 0,
      userId: 0,
      type: "follow",
      id: "",
      timestamp: parseInt(data.sendTimeMs),
      info: {
        user: getUserInfo(data.userInfo),
      },
    };
    msg.id = generateId(msg);
    msg.userId = msg.info.user.id;
    return msg;
  },
  CommonActionSignalLike: (data, room) => {
    const msg: LiveMessage.Interact = {
      platform: "acfun",
      roomId: room?.id || 0,
      userId: 0,
      type: "like",
      id: "",
      timestamp: parseInt(data.sendTimeMs),
      info: {
        user: getUserInfo(data.userInfo),
      },
    };
    msg.id = generateId(msg);
    msg.userId = msg.info.user.id;
    return msg;
  },
  AcfunActionSignalJoinClub: (data, room) => {
    const msg: LiveMessage.Interact = {
      platform: "acfun",
      roomId: room?.id || 0,
      userId: 0,
      type: "join",
      id: "",
      timestamp: parseInt(data.joinTimeMs),
      info: {
        user: {
          id: parseInt(data.fansInfo.userId || "") || 0,
          name: data.fansInfo.name || "",
        },
      },
    };
    msg.id = generateId(msg);
    msg.userId = msg.info.user.id;
    return msg;
  },
  CommonStateSignalDisplayInfo: (data, room) => {
    const msg: LiveMessage.LiveStats = {
      platform: "acfun",
      roomId: room?.id || 0,
      userId: 0,
      type: "live_stats",
      id: "",
      timestamp: getDateTimestamp(),
      info: {
        like: stringToNumber(data.likeCount),
        online: stringToNumber(data.watchingCount),
      },
    };
    msg.id = generateId(msg);
    return msg;
  },
  ZtLiveScStatusChanged: (data, room) => {
    const base = {
      platform: "acfun",
      roomId: room?.id || 0,
      userId: 0,
      id: "",
      timestamp: getDateTimestamp(),
    };
    let msg: LiveMessage.LiveEnd | LiveMessage.LiveCut;
    switch (data.type) {
      case RawMessage.StatusChangedType.LIVE_CLOSED:
        msg = {
          ...base,
          type: "live_end",
          info: {
            status: LiveRoomStatus.off,
          },
        };
        break;
      case RawMessage.StatusChangedType.LIVE_BANNED:
        msg = {
          ...base,
          type: "live_cut",
          info: {
            message: data.bannedInfo?.banReason || "",
          },
        };
        break;
      default:
        return;
    }
    msg.id = generateId(msg);
    return msg;
  },
};

/** 根据守护徽章字符串获取粉丝牌信息 */
function getMedalInfo(badge?: string): MedalInfo | null {
  if (badge) {
    let medalInfo = JSON.parse(badge).medalInfo;
    return {
      name: medalInfo.clubName,
      id: medalInfo.uperId,
      level: medalInfo.level,
    };
  } else {
    return null;
  }
}

function getUserInfo(
  user: RawMessage.ZtLiveUserInfo,
  anchorId?: number
): UserInfo {
  let identity: UserType | null = 0;
  if (user.userIdentity?.managerType == 1) {
    identity = UserType.admin;
  } else if (parseInt(user.userId) == anchorId) {
    identity = UserType.anchor;
  }
  return {
    name: user.nickname,
    id: parseInt(user.userId),
    medal: getMedalInfo(user.badge),
    avatar: user.avatar[0].url,
    type: identity,
  };
}

function getGiftInfo(
  gift: RawMessage.CommonActionSignalGift,
  giftList?: GiftList
): GiftInfo {
  const { giftId, batchSize, comboKey, rank } = gift;
  const { giftName, webpPicList, payWalletType } =
    giftList?.find((val) => val.giftId.toString() == giftId) || {};
  const value = parseInt(rank);
  const currency = payWalletType || (value < 1000 ? 1 : 2);
  return {
    id: giftId,
    name: giftName || `${giftId}号礼物`,
    num: batchSize,
    value: currency == 1 ? value / 1000 : value,
    currency: currency,
    image: webpPicList?.[0].url,
    comboId: comboKey,
  };
}

export function parseMessage<T extends keyof MessageTypes>(
  type: T,
  data: MessageTypes[T],
  room?: LiveRoomData,
  giftList?: GiftList
) {
  return parsingFunction[type]?.(data, room, giftList);
}
