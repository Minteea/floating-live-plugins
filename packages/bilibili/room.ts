import { BilibiliRoomData, ConnectTokens } from "./types";
import { LiveWS, parseLiveConfig } from "bilibili-live-danmaku";
import { parseGetInfoByRoom, parseMessage, parseRoomBaseInfo } from "./parser";
import {
  LiveConnectionStatus,
  UserInfo,
  LiveRoomStatsInfo,
  LiveRoomDetailInfo,
  LiveRoom,
  LiveRoomOpenStatus,
} from "floating-live";
import { BilibiliApiClientEx } from "./utils/request";

/** 配置项 */
export interface RoomOptions {
  /** 是否自动初始化(默认为true) */
  init?: boolean;
  /** 生成房间后是否立即打开 */
  open?: boolean;
  /** 自动重连(默认为false) */
  autoReconnect?: boolean;
  /** 登录凭据，若为空，则初始化时自动生成 */
  credentials?: string;
  /** 连接凭证，若为空，则初始化时自动生成 */
  tokens?: ConnectTokens;
  /** 用户代理，若为空，则使用默认值 */
  userAgent?: string;
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
  fetch?: (input: string | URL, init?: RequestInit) => Promise<Response>;
}

const symbolAbortController: unique symbol = Symbol("abortController");

interface ClientWithAbortController extends LiveWS {
  [symbolAbortController]: AbortController;
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
  /** 是否连接上房间 */
  public connected: boolean = false;
  /** 主播信息 */
  public anchor: UserInfo = { name: "", id: 0 };
  /** 直播间弹幕api客户端 */
  public client: ClientWithAbortController | null = null;
  /** 断线重连间隔 */
  public connectInterval: number;
  /** 连接超时阈值 */
  public connectTimeout: number;
  /** 自动重连 */
  public autoReconnect: boolean;

  /** 是否初始化 */
  public whenInit: Promise<RoomBilibili>;

  /** 连接凭证 */
  #tokens?: ConnectTokens;
  /** 用户cookie */
  #apiClient: BilibiliApiClientEx;

  get userAgent() {
    return this.#apiClient.userAgent;
  }
  set userAgent(ua: string) {
    this.#apiClient.userAgent = ua;
  }

  /** 是否处于重连状态 */
  private reconnecting: boolean = false;
  /** 最后一次连接时间 */
  private lastConnectionTime = 0;

  /** 自定义fetchData */
  customFetchData?: (id: number | string) => BilibiliRoomData;
  /** 自定义fetchTokens */
  customFetchTokens?: (
    roomId: number,
    credentials: string
  ) => Promise<ConnectTokens>;

  constructor(
    /** 房间id */
    id: number,
    options: RoomOptions = {}
  ) {
    super();
    this.id = id;
    this.connectInterval = options.connectInterval ?? 500;
    this.connectTimeout = options.connectTimeout ?? 45000;
    this.autoReconnect = options.autoReconnect ?? false;
    this.#tokens = options.tokens;

    this.#apiClient = new BilibiliApiClientEx({
      userAgent: options.userAgent,
      cookie: options.credentials,
      fetch: options.fetch,
    });

    options.data && this.setData(options.data);

    const init = options.init ?? true;
    if (init) {
      this.whenInit = this.init(options).then(() => this);
    } else {
      this.whenInit = new Promise((res) => res(this));
    }
  }
  /** 初始化
   * 自动获取并设置 `credentials` ，自动获取房间信息和连接 `token`
   */
  protected async init(options: RoomOptions = {}) {
    const { open, data, tokens } = options;
    if (open) this.openStatus = 1;

    // 设置必要 cookie
    // 如果cookie中没有buvid3字段，会自动获取一个
    await this.setCredentials(this.#apiClient.cookie, false);

    // 自动更新房间信息
    if (!data) await this.update();

    // 自动更新房间 tokens
    if (!tokens) await this.updateTokens();

    // 自动开启
    if (open) {
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

    try {
      const res = await this.#apiClient.xliveGetInfoByRoom({
        room_id: this.id,
      });
      return parseGetInfoByRoom(res.data);
    } catch (e) {
      // fallback

      const res = await this.#apiClient.xliveGetRoomBaseInfo({
        room_ids: [this.id],
      });
      for (const r in res.data.by_room_ids) {
        return parseRoomBaseInfo(res.data.by_room_ids[r]);
      }
      throw new Error("房间不存在");
    }
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
    if (this.openStatus) return;
    this.openStatus = LiveRoomOpenStatus.opening;
    await this.update();
    this.openWebsocketClient();
  }

  /** 设置登录凭据 */
  async setCredentials(credentials: string, updateTokens = true) {
    this.#apiClient.setCookie(credentials);
    // 在没有buvid3的情况下，访问bilibili主页，获得buvid3
    if (!this.#apiClient.cookies.has("buvid3")) {
      this.#apiClient.wwwBilibili();
    }
    if (updateTokens) this.updateTokens();
  }

  /** 更新连接tokens */
  async updateTokens() {
    this.setTokens(await this.fetchTokens());
  }

  /** 请求连接tokens */
  async fetchTokens(): Promise<ConnectTokens> {
    if (this.customFetchTokens) {
      return this.customFetchTokens(this.roomId, this.#apiClient.cookie);
    }
    const buvid = this.#apiClient.cookies.get("buvid3");
    const uid = parseInt(this.#apiClient.cookies.get("DedeUserID"));
    const { key } = await parseLiveConfig(
      (
        await this.#apiClient.xliveGetDanmuInfo({ id: this.roomId })
      ).data
    );
    return {
      uid,
      buvid,
      key,
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
    this.client?.addEventListener(
      "open",
      () => {
        lastClient?.[symbolAbortController].abort();
        lastClient?.close();
        this.reconnecting = false;
      },
      { once: true }
    );
  }

  private emitConnention(status: LiveConnectionStatus) {
    this.connectionStatus = status;
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

  /** 打开直播弹幕客户端 */
  private openWebsocketClient() {
    // 如果直播间不可用，则返回
    if (!this.available) {
      this.openStatus = LiveRoomOpenStatus.closed;
      return;
    }
    this.initClient();
    this.openStatus = LiveRoomOpenStatus.opened;
    this.emit("open");
  }

  /** 创建直播弹幕客户端 */
  private initClient() {
    this.emitConnention(LiveConnectionStatus.connecting);
    // 与Websocket服务器连接
    const client = new LiveWS(this.roomId || this.id, {
      uid: this.#tokens?.uid,
      buvid: this.#tokens?.buvid,
      key: this.#tokens?.key,
    }) as ClientWithAbortController;

    console.log(this.#tokens);

    const controller = new AbortController();
    const signal = controller.signal;
    client[symbolAbortController] = controller;

    this.lastConnectionTime = Date.now();
    console.log(client.ws.url);
    client.addEventListener(
      "open",
      () => {
        // 连接到服务器
        this.opened && this.emitConnention(LiveConnectionStatus.connected);
      },
      { signal }
    );
    client.addEventListener(
      "close",
      () => {
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
      },
      { signal }
    );
    client.addEventListener(
      "CONNECT_SUCCESS",
      () => {
        // 连接到直播间
        this.emitConnention(LiveConnectionStatus.entered);
      },
      { signal }
    );
    client.addEventListener(
      "MESSAGE",
      ({ data }) => {
        const m = parseMessage(data, this);
        m && this.emitMessage(m);
        this.emitRaw(data);
      },
      { signal }
    );
    this.client = client;
  }
  /** 关闭直播间监听 */
  close() {
    if (!this.opened) return;
    this.openStatus = LiveRoomOpenStatus.closed;
    this.client?.close();
    this.emitConnention(LiveConnectionStatus.off);
    this.emit("close");
  }
}

export default RoomBilibili;
