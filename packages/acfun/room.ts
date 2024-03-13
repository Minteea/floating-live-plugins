import { LiveRoom } from "floating-live/core";
import { ConnectStatus, RoomStatus, UserType } from "floating-live/enums";
import {
  RoomDetail,
  MedalInfo,
  UserInfo,
  Message,
  RoomStatsInfo,
  RoomInfo,
} from "floating-live/types";
import { AcClient } from "acfun-live-danmaku/client";
import { ConnectTokens, RawMessage } from "./types";
import {
  getDid,
  getGiftList,
  getStartPlayInfo,
  parseCookieString,
  visitorLogin,
} from "./utils";
import { GiftList, LoginInfo } from "acfun-live-danmaku/types";
import { parseMessage } from "./parser";

export interface RoomOptions {
  open?: boolean;
  /** 登录凭据 */
  credentials?: string;
  /** 连接凭证 */
  tokens?: ConnectTokens;
  /** 房间信息 */
  // info?: RoomInfo;
  /** 礼物列表 */
  // giftList?: GiftList;
}

export class RoomAcfun extends LiveRoom {
  /** 平台id */
  readonly platform: string = "acfun";
  /** 房间id */
  readonly id: number;
  /** 直播展示信息 */
  public detail: RoomDetail = {
    /** 直播标题 */
    title: "",
    /** 分区 */
    area: [],
    /** 封面 */
    cover: "",
  };
  /** 直播数据信息 */
  public stats: RoomStatsInfo = {
    /** 点赞数 */
    like: 0,
    /** 在线观看数 */
    online: 0,
  };
  /** 主播信息 */
  public anchor: UserInfo = { name: "", id: 0 };
  /** 直播间弹幕api模块 */
  public client: AcClient | null = null;
  /** 是否为打开状态 */
  public opened: boolean = false;
  /** 是否连接上服务器 */
  public connected: boolean = false;

  private wsInit: boolean = false;
  /** 直播间是否可用 */
  public available: boolean = false;
  /** 是否处于正在打开的状态 */
  private opening: boolean = false;
  /** 是否处于重连状态 */
  private reconnecting: boolean = false;

  private tokens: ConnectTokens = {
    did: "",
    userId: 0,
    st: "",
    security: "",
    liveId: "",
    availableTickets: [],
    enterRoomAttach: "",
  };

  public giftList?: GiftList;

  constructor(id: number, options?: RoomOptions) {
    super();
    this.id = id; // 直播间号
    this.anchor.id = id; // 主播uid
    this.init(options);
  }
  protected async init(options: RoomOptions = {}) {
    const { tokens, credentials, open } = options;
    if (open) this.opening = true;
    if (!(tokens?.userId && tokens.security && tokens.st && tokens.did)) {
      Object.assign(
        this.tokens,
        await this.fetchLoginTokens(credentials || "")
      );
    } else {
      Object.assign(this.tokens, tokens);
    }
    await this.getInfo();
    this.giftList = await this.fetchGiftList();
    if (open) {
      this.opening = false;
      this.openWS();
    }
    this.emit("init");
  }
  public async getInfo() {
    await this.fetchInfo()
      .then((info) => {
        const tokens = {
          liveId: info.liveId!,
          availableTickets: info.availableTickets,
          enterRoomAttach: info.enterRoomAttach,
        };
        if (this.opening) {
          this.liveId = info.liveId;
          Object.assign(this.tokens, tokens);
        }
        this.updateInfo(info);
        return info;
      })
      .catch((error) => {
        this.emit("info_error", error);
      });
  }
  async fetchInfo(): Promise<
    RoomInfo & { availableTickets: string[]; enterRoomAttach: string }
  > {
    const id = this.id;
    const { did, userId, st } = { ...this.tokens };
    const {
      liveId,
      caption,
      liveStartTime,
      availableTickets,
      enterRoomAttach,
    } = await getStartPlayInfo({
      authorId: id,
      userId: userId,
      did: did,
      st: st,
    }).catch(() => ({
      liveId: "",
      caption: "",
      liveStartTime: 0,
      availableTickets: [] as string[],
      enterRoomAttach: "",
    }));
    const { profile } = await fetch(
      `https://live.acfun.cn/rest/pc-direct/user/userInfo?userId=${this.id}`,
      {
        method: "GET",
      }
    ).then((response) => response.json());
    return {
      platform: "acfun",
      id: id,
      key: `acfun:${id}`,
      liveId: liveId,
      detail: {
        title: caption,
        cover: `https://tx2.a.kwimgs.com/bs2/ztlc/cover_${liveId}_raw.jpg`,
      },
      anchor: {
        id: id,
        name: profile.name,
        avatar: profile.avatar,
      },
      status: liveId ? RoomStatus.live : RoomStatus.off,
      timestamp: liveStartTime,
      available: !!enterRoomAttach,
      connection: 0,
      opened: false,
      availableTickets,
      enterRoomAttach,
    };
  }
  async fetchGiftList() {
    return getGiftList({ ...this.tokens, authorId: this.id }).catch(() => []);
  }

  /** 更新直播间信息 */
  updateInfo({
    status,
    timestamp,
    detail,
    stats,
    anchor,
    liveId,
    available,
  }: RoomInfo) {
    this.status = status;
    this.timestamp = timestamp;
    this.detail = detail;
    stats && (this.stats = stats);
    this.anchor = anchor;
    this.liveId = liveId;
    this.available = available;
    this.emit("info", this.info);
  }

  /** 开启直播间监听 */
  public async open() {
    // 如果直播间监听已打开或处于正在打开状态，则返回
    if (this.opened || this.opening) return;
    this.opening = true;
    await this.getInfo();
    this.opening = false;
    this.openWS();
  }

  /** 设置登录凭据 */
  async setCredentials(credentials: string, userToken?: ConnectTokens) {
    const cookie = parseCookieString(credentials);
    const did = userToken?.did || cookie._did || (await getDid());
    let st = userToken?.st;
    let userId = userToken?.userId;
    let security = userToken?.security;
    if (!(st && userId && security)) {
      const loginInfo = await this.fetchLoginTokens(credentials);
      st = loginInfo.st;
      userId = loginInfo.userId;
      security = loginInfo.security;
    }
    const tokens: ConnectTokens = {
      did,
      st,
      userId,
      security,
      liveId: "",
      availableTickets: [],
      enterRoomAttach: "",
    };
    this.tokens = tokens;

    const info = await this.fetchInfo();
    const { liveId, availableTickets, enterRoomAttach } = info;

    this.setTokens({
      ...tokens,
      liveId: liveId!,
      availableTickets,
      enterRoomAttach,
    });
  }

  /** 获取登录token */
  async fetchLoginTokens(credentials: string) {
    const cookie = parseCookieString(credentials);
    const did = cookie._did || (await getDid());
    // const acPasstoken = cookie["acPasstoken"];
    // const authKey = cookie["auth_key"];
    const { st, userId, security } = await visitorLogin(did);
    return { did, st, userId, security };
  }

  /** 重连 */
  /** 设置直播连接token */
  setTokens(tokens: ConnectTokens) {
    this.tokens = tokens;
    if (this.opened) {
      // 如果已打开，则重连
      this.reconnect();
    }
  }
  reconnect() {
    if (this.reconnecting) return;
    this.reconnecting = true;
    const lastClient = this.client;
    if (!lastClient) return;
    this.initClient();
    this.client?.once("open", () => {
      lastClient.removeAllListeners();
      lastClient.close();
      this.reconnecting = false;
    });
  }

  private openWS() {
    // 如果直播间不可用，则返回
    if (!this.available) return;
    this.initClient();
    this.opened = true;
    this.emit("open");
  }
  private emitConnention(status: ConnectStatus) {
    this.connection = status;
    switch (status) {
      case ConnectStatus.connecting:
        this.emit("connecting");
        break;
      case ConnectStatus.connected:
        this.emit("connected");
        break;
      case ConnectStatus.entered:
        this.emit("enter");
        break;
      case ConnectStatus.disconnected:
        this.emit("disconnect");
        break;
    }
  }
  /** 初始化直播服务端监听 */
  private async initClient() {
    if (this.client) return;
    this.emitConnention(ConnectStatus.connecting);

    const client = new AcClient(this.tokens);

    client.on("open", () => {
      this.emitConnention(ConnectStatus.connected);
    });

    client.on("EnterRoomAck", () => {
      this.emitConnention(ConnectStatus.entered);
    });

    client.on("StateSignal", (signalType: string, payload: any) => {
      const msg = parseMessage(signalType as any, payload, this);
      msg && this.emitMessage(msg);
      this.emitRaw({
        messageType: "ZtLiveScStateSignal",
        payload: {
          signalType,
          payload,
        },
      } satisfies RawMessage.ZtLiveScMessage<RawMessage.ZtLiveStateSignalItem>);
    });
    client.on("ActionSignal", (signalType: string, payload: any) => {
      const msg = parseMessage(signalType as any, payload, this, this.giftList);
      msg && this.emitMessage(msg);
      this.emitRaw({
        messageType: "ZtLiveScActionSignal",
        payload: { signalType, payload },
      } satisfies RawMessage.ZtLiveScMessage<RawMessage.ZtLiveActionSignalItem>);
    });
    client.on("NotifySignal", (signalType: string, payload: any) => {
      const msg = parseMessage(signalType as any, payload, this);
      msg && this.emitMessage(msg);
      this.emitRaw({
        messageType: "ZtLiveScNotifySignal",
        payload: { signalType, payload },
      } satisfies RawMessage.ZtLiveScMessage<RawMessage.ZtLiveNotifySignalItem>);
    });
    client.on("StatusChanged", (data: RawMessage.ZtLiveScStatusChanged) => {
      const msg = parseMessage("ZtLiveScStatusChanged", data, this);
      msg && this.emitMessage(msg);
      this.emitRaw({
        messageType: "ZtLiveScStatusChanged",
        payload: data,
      } satisfies RawMessage.ZtLiveScMessage<RawMessage.ZtLiveScStatusChanged>);
    });
    this.client = client;
    this.wsInit = true;
  }
  /** 关闭直播间监听 */
  close() {
    if (!this.opened) return;
    this.opened = false;
    this.client?.wsClose();
    this.emitConnention(ConnectStatus.off);
    this.emit("close");
  }
  destroy() {
    this.close();
    this.removeAllListeners();
  }
}

export default RoomAcfun;
