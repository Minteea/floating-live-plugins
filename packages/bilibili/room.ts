import { BilibiliRoomData, ConnectTokens } from "./types";
import { LiveWS } from "bilibili-live-ws";
import { parseInfo, parseMessage } from "./parser";
import {
  FetchOptions,
  getBuvid,
  getInfoByRoom,
  getLoginUid,
  getToken,
  parseCookieString,
} from "./utils";
import {
  LiveConnectionStatus,
  UserInfo,
  LiveRoomStatsInfo,
  LiveRoomDetailInfo,
  LiveRoom,
} from "floating-live";

/** 配置项 */
export interface RoomOptions {
  /** 生成房间后是否立即打开 */
  open?: boolean;
  /** 自动重连(默认为false) */
  autoReconnect?: boolean;
  /** 登录凭据，若为空，则初始化时自动生成 */
  credentials?: string;
  /** 连接凭证，若为空，则初始化时自动生成 */
  tokens?: ConnectTokens;
  /** 预设置的房间数据，若设置，将不会自动更新直播间数据 */
  data?: BilibiliRoomData;
  /** 断线重连间隔(默认值为500ms) */
  connectInterval?: number;
  /** 连接超时阈值(默认值为45000ms) */
  connectTimeout?: number;

  /** 自定义fetchData */
  customFetchData?: (id: number | string) => Promise<BilibiliRoomData>;
  /** 自定义fetchTokens */
  customFetchTokens?: (roomId: number) => Promise<ConnectTokens>;

  /** 自定义fetch函数 */
  fetch?: (id: number | string) => BilibiliRoomData;
}

export class RoomBilibili extends LiveRoom implements BilibiliRoomData {
  /** 平台id */
  readonly platform: string = "bilibili";
  /** 直播间号 */
  readonly id: number;
  /** 直播间room_id */
  public roomId: number = 0;
  /** 直播间短房号 */
  public shortId: number = 0;
  /** 房间信息 */
  public detail: LiveRoomDetailInfo = {
    /** 直播标题 */
    title: "",
    /** 分区 */
    area: [],
    /** 封面url */
    cover: "",
  };
  public stats: LiveRoomStatsInfo = {
    /** 观看数 */
    view: 0,
    /** 点赞数 */
    like: 0,
  };
  /** 房间是否可用
   *  可用满足条件：存在tokens和roomId
   */
  public available: boolean = false;
  /** 是否连接上房间 */
  public connected: boolean = false;
  /** 主播信息 */
  public anchor: UserInfo = { name: "", id: 0 };
  /** 直播间弹幕api客户端 */
  public client: LiveWS | null = null;
  /** 断线重连间隔 */
  public connectInterval: number;
  /** 连接超时阈值 */
  public connectTimeout: number;
  /** 自动重连 */
  public autoReconnect: boolean;

  /** 用户凭据 */
  #credentials?: string;
  /** 连接凭证 */
  #tokens?: ConnectTokens;
  /** 用户代理 */
  userAgent?: string;

  /** 是否处于正在打开的状态 */
  private opening: boolean = false;
  /** 是否处于重连状态 */
  private reconnecting: boolean = false;
  /** 最后一次连接时间 */
  private lastConnectionTime = 0;

  /** 自定义fetchData */
  customFetchData?: (id: number | string) => BilibiliRoomData;
  /** 自定义fetchTokens */
  customFetchTokens?: (
    roomId: number,
    credentials: string,
    userToken?: ConnectTokens
  ) => Promise<ConnectTokens>;

  /** 自定义fetch函数 */
  fetch?: (
    input: RequestInfo | URL,
    init?: RequestInit | undefined
  ) => Promise<Response> = globalThis.fetch;

  constructor(
    /** 房间id */
    id: number,
    options: RoomOptions = {}
  ) {
    super();
    this.id = id;
    this.connectInterval = options?.connectInterval ?? 500;
    this.connectTimeout = options?.connectTimeout ?? 45000;
    this.autoReconnect = options?.autoReconnect ?? false;
    this.init(options);
  }
  /** 初始化 */
  protected async init(options: RoomOptions = {}) {
    const { data, tokens, credentials, open } = options;
    if (open) this.opening = true;
    if (data) {
      this.setData(data);
    } else {
      await this.update();
    }
    if (tokens?.userId && tokens?.buvid && tokens?.token) {
      this.setTokens(tokens as ConnectTokens);
    } else {
      await this.setCredentials(credentials || "", tokens);
    }
    if (open) {
      this.opening = false;
      this.openWebsocketClient();
    }
    this.emit("init");
  }

  /** 更新房间信息 */
  async update() {
    const data = await this.fetchData();
    this.roomId = data.id as number;
    this.setData(data);
    return data;
  }
  /** 获取房间信息 */
  async fetchData(): Promise<BilibiliRoomData> {
    if (this.customFetchData) return this.customFetchData(this.id);
    const rawInfo = await getInfoByRoom(this.id);
    return parseInfo(rawInfo);
  }

  /** 设置直播间数据 */
  setData({
    roomId,
    shortId,
    status,
    timestamp,
    detail,
    stats,
    anchor,
    liveId,
    available,
  }: BilibiliRoomData) {
    this.roomId = roomId;
    this.shortId = shortId;
    this.status = status;
    this.timestamp = timestamp;
    this.detail = detail;
    this.stats = stats!;
    this.anchor = anchor;
    this.liveId = liveId;
    this.available = available;
    const data = this.toData();
    this.emit("update", { room: data });
    return data;
  }

  /** 开启直播间监听 */
  public async open() {
    // 如果直播间监听已打开或处于正在打开状态，则返回
    if (this.opened || this.opening) return;
    this.opening = true;
    await this.update();
    this.opening = false;
    this.openWebsocketClient();
  }

  private openWebsocketClient() {
    // 如果直播间不可用，则返回
    if (!this.available) return;
    this.opened = true;
    this.initClient();
    this.emit("open");
  }

  /** 设置登录凭据 */
  async setCredentials(credentials: string, userToken?: ConnectTokens) {
    this.#credentials = credentials;
    this.setTokens(await this.fetchTokens(credentials, userToken));
  }
  /** 请求连接tokens */
  async fetchTokens(
    credentials: string = "",
    userToken?: ConnectTokens
  ): Promise<ConnectTokens> {
    if (this.customFetchTokens) {
      return this.customFetchTokens(this.roomId, credentials, userToken);
    }
    const cookie = parseCookieString(credentials);
    const buvid =
      userToken?.buvid ||
      cookie["buvid3"] ||
      (await getBuvid(this.#getFetchOptions())) ||
      "";
    const userId =
      userToken?.userId ||
      parseInt(cookie["DedeUserID"]) ||
      (await getLoginUid(this.#getFetchOptions()));
    const token = await getToken(this.roomId, this.#getFetchOptions());
    return {
      userId,
      buvid,
      token,
    };
  }
  /** 设置直播连接tokens */
  setTokens(tokens: ConnectTokens) {
    this.#tokens = tokens;
    if (this.opened) {
      // 如果已打开，则重连
      this.reconnect();
    }
  }
  /** 无缝重连 */
  reconnect() {
    // 如果正在重连，则返回
    if (this.reconnecting) return;
    this.reconnecting = true;
    const lastClient = this.client;
    this.initClient();
    // 重连成功后，关闭上一个连接
    this.client?.once("open", () => {
      lastClient?.removeAllListeners();
      lastClient?.close();
      this.reconnecting = false;
    });
  }

  private emitConnention(status: LiveConnectionStatus) {
    this.connection = status;
    switch (status) {
      case LiveConnectionStatus.connecting:
        this.emit("connecting");
        break;
      case LiveConnectionStatus.connected:
        this.emit("connected");
        break;
      case LiveConnectionStatus.entered:
        this.emit("enter");
        break;
      case LiveConnectionStatus.disconnected:
        this.emit("disconnect");
        break;
    }
  }
  #getFetchOptions(): FetchOptions {
    return {
      fetch: this.fetch,
      userAgent: this.userAgent,
      cookie: this.#credentials,
    };
  }
  /** 创建直播弹幕客户端 */
  private initClient() {
    if (!this.#tokens) return;
    this.emitConnention(LiveConnectionStatus.connecting);
    // 与Websocket服务器连接
    const client = new LiveWS(this.roomId || this.id, {
      uid: this.#tokens.userId,
      buvid: this.#tokens.buvid,
      key: this.#tokens.token,
    });
    this.lastConnectionTime = Date.now();

    client.on("open", () => {
      // 连接到服务器
      this.opened && this.emitConnention(LiveConnectionStatus.connected);
    });
    client.on("close", () => {
      // 断开连接
      this.opened && this.emitConnention(LiveConnectionStatus.disconnected);
      // 自动重连
      if (this.opened && this.autoReconnect) {
        const timeout =
          this.lastConnectionTime + this.connectInterval - Date.now();
        if (timeout > 0) {
          const t = setTimeout(() => {
            this.reconnect();
            clearTimeout(t);
          }, timeout);
        } else {
          this.reconnect();
        }
      }
    });
    client.on("live", () => {
      // 连接到直播间
      this.emitConnention(LiveConnectionStatus.entered);
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
    this.emitConnention(LiveConnectionStatus.off);
    this.emit("close");
  }
}

export default RoomBilibili;
