import { BilibiliRoomInfo, ConnectTokens } from "./types";
import { LiveRoom } from "floating-live";
import { UserInfo, RoomStatsInfo, RoomDetail, RoomInfo } from "floating-live";
import { KeepLiveWS } from "bilibili-live-ws";
import { parseInfo, parseMessage } from "./parser";
import {
  getBuvid,
  getInfoByRoom,
  getLoginUid,
  getToken,
  parseCookieString,
} from "./utils";
import { ConnectStatus } from "floating-live";

/** 配置项 */
export interface RoomOptions {
  /** 生成房间后是否打开 */
  open?: boolean;
  /** 登录凭据 */
  credentials?: string;
  /** 连接凭证 */
  tokens?: ConnectTokens;
  /** 房间信息 */
  info?: BilibiliRoomInfo;
  /** 断线重连间隔(默认值为100ms) */
  connectInterval?: number;
}

export class RoomBilibili extends LiveRoom implements BilibiliRoomInfo {
  /** 平台id */
  readonly platform: string = "bilibili";
  /** 直播间号 */
  readonly id: number;
  /** 直播间room_id */
  public roomId: number = 0;
  /** 直播间短房号 */
  public shortId: number = 0;
  /** 房间信息 */
  public detail: RoomDetail = {
    /** 直播标题 */
    title: "",
    /** 分区 */
    area: [],
    /** 封面url */
    cover: "",
  };
  public stats: RoomStatsInfo = {
    /** 观看数 */
    view: 0,
    /** 点赞数 */
    like: 0,
  };
  /** 房间是否可用 */
  public available: boolean = false;
  /** 是否连接上房间 */
  public connected: boolean = false;
  /** 主播信息 */
  public anchor: UserInfo = { name: "", id: 0 };
  /** 直播间弹幕api模块 */
  public client: KeepLiveWS | null = null;
  /** 断线重连间隔 */
  public connectInterval: number;

  /** 连接凭证 */
  private tokens: ConnectTokens = {
    userId: 0,
    buvid: "",
    token: "",
  };

  /** 是否处于正在打开的状态 */
  private opening: boolean = false;
  /** 是否处于重连状态 */
  private reconnecting: boolean = false;

  constructor(
    /** 房间id */
    id: number,
    options?: RoomOptions
  ) {
    super();
    this.id = id;
    this.connectInterval = options?.connectInterval || 100;
    this.init(options);
  }
  /** 初始化 */
  protected async init(options: RoomOptions = {}) {
    const { info, tokens, credentials, open } = options;
    if (open) this.opening = true;
    if (info) {
      this.updateInfo(info);
    } else {
      await this.getInfo();
    }
    if (tokens?.userId && tokens?.buvid && tokens?.token) {
      this.setTokens(tokens as ConnectTokens);
    } else {
      await this.setCredentials(credentials || "", tokens);
    }
    if (open) {
      this.opening = false;
      this.openWS();
    }
    this.emit("init");
  }

  /** 获取房间信息 */
  public async getInfo() {
    await this.fetchInfo()
      .then((info) => {
        this.roomId = info.id as number;
        this.updateInfo(info);
      })
      .catch((error) => {
        this.emit("info_error", error);
      });
  }
  /** 请求房间信息 */
  async fetchInfo(): Promise<BilibiliRoomInfo> {
    const rawInfo = await getInfoByRoom(this.id);
    return parseInfo(rawInfo);
  }
  /** 更新直播间信息 */
  updateInfo({
    roomId,
    shortId,
    status,
    timestamp,
    detail,
    stats,
    anchor,
    liveId,
    available,
  }: BilibiliRoomInfo) {
    this.roomId = roomId;
    this.shortId = shortId;
    this.status = status;
    this.timestamp = timestamp;
    this.detail = detail;
    this.stats = stats!;
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
  private openWS() {
    // 如果直播间不可用，则返回
    if (!this.available) return;
    this.initClient();
    this.emit("open");
  }

  /** 设置登录凭据 */
  async setCredentials(credentials: string, userToken?: ConnectTokens) {
    this.setTokens(await this.fetchTokens(credentials, userToken));
  }
  /** 请求连接tokens */
  async fetchTokens(
    credentials: string = "",
    userToken?: ConnectTokens
  ): Promise<ConnectTokens> {
    const cookie = parseCookieString(credentials);
    const buvid =
      userToken?.buvid ||
      cookie["buvid3"] ||
      (await getBuvid(credentials)) ||
      "";
    const userId =
      userToken?.userId ||
      parseInt(cookie["DedeUserID"]) ||
      (await getLoginUid(credentials));
    const token = await getToken(this.roomId, credentials);
    return {
      userId,
      buvid,
      token,
    };
  }
  /** 设置直播连接tokens */
  setTokens(tokens: ConnectTokens) {
    this.tokens = tokens;
    if (this.opened) {
      // 如果已打开，则重连
      this.reconnect();
    }
  }
  /** 重连 */
  reconnect() {
    if (this.reconnecting) return;
    this.reconnecting = true;
    const lastClient = this.client;
    if (!lastClient) {
      this.reconnecting = false;
      return;
    }
    this.initClient();
    this.client?.once("open", () => {
      lastClient.removeAllListeners();
      lastClient.close();
      this.reconnecting = false;
    });
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
  /** 创建直播弹幕客户端 */
  private initClient() {
    this.emitConnention(ConnectStatus.connecting);
    // 与Websocket服务器连接
    const client = new KeepLiveWS(this.roomId || this.id, {
      uid: this.tokens.userId,
      buvid: this.tokens.buvid,
      key: this.tokens.token,
    });
    client.interval = this.connectInterval;

    client.on("open", () => {
      // 连接到服务器
      this.opened && this.emitConnention(ConnectStatus.connected);
    });
    client.on("close", () => {
      // 断开连接
      this.opened && this.emitConnention(ConnectStatus.disconnected);
    });
    client.on("live", () => {
      // 连接到直播间
      this.emitConnention(ConnectStatus.entered);
    });
    client.on("msg", (data: any) => {
      const m = parseMessage(data, this);
      m && this.emitMessage(m);
      this.emitRaw(data);
    });
    this.client = client;
  }
  /** 关闭直播间监听 */
  close() {
    if (!this.opened) return;
    this.opened = false;
    this.client?.close();
    this.emit("close");
  }
}

export default RoomBilibili;
