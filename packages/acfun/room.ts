import { LiveRoom } from "floating-live";
import { LiveConnectionStatus, LiveRoomStatus, UserType } from "floating-live";
import {
  LiveRoomDetailInfo,
  MedalInfo,
  UserInfo,
  LiveMessage,
  LiveRoomStatsInfo,
  LiveRoomData,
} from "floating-live";
import {
  AcClient,
  LiveInfo,
  GiftList,
  LoginInfo,
  MessageData,
  FetchOptions,
  requestTokenGet,
  ClientTokens,
} from "acfun-live-danmaku";
import {
  requestDidCookie,
  getGiftList,
  getStartPlayInfo,
  requestVisitorLogin,
} from "acfun-live-danmaku";
import { parseMessage } from "./parser";
import { requestUserInfo } from "./utils";
import { Cookies } from "@floating-live/cookies";

export interface ConnectTokens extends LoginInfo, LiveInfo {
  did: string;
}
export interface RoomOptions {
  /** 是否自动初始化(默认为true) */
  init?: boolean;
  /** 生成房间后是否立即打开 */
  open?: boolean;
  /** 登录凭据 */
  credentials?: string;
  /** 连接凭证 */
  tokens?: ConnectTokens | (LoginInfo & { did: string });

  /** 预设置的房间数据，若设置，将不会自动更新直播间数据 */
  data?: LiveRoomData;
  /** 断线重连间隔(默认值为500ms) */
  connectInterval?: number;
  /** 连接超时阈值(默认值为45000ms) */
  connectTimeout?: number;
  /** 自动重连 */
  autoReconnect?: boolean;

  /** 自定义fetchData */
  customFetchData?: (id: number | string) => Promise<LiveRoomData>;
  /** 自定义fetchTokens */
  customFetchTokens?: (id: number) => Promise<ConnectTokens>;
  /** 自定义fetchGiftList */
  customFetchGiftList?: (id: number) => Promise<GiftList>;

  /** 自定义fetch函数 */
  fetch?: (input: string | URL, init?: RequestInit) => Promise<Response>;
}

const symbolAbortController: unique symbol = Symbol("abortController");

interface ClientWithAbortController extends AcClient {
  [symbolAbortController]: AbortController;
}

export class RoomAcfun extends LiveRoom {
  /** 平台id */
  readonly platform: string = "acfun";
  /** 房间id */
  readonly id: number;
  /** 直播展示信息 */
  public detail: LiveRoomDetailInfo = {
    /** 直播标题 */
    title: "",
    /** 分区 */
    area: [],
    /** 封面 */
    cover: "",
  };
  /** 直播数据信息 */
  public stats: LiveRoomStatsInfo = {
    /** 点赞数 */
    like: 0,
    /** 在线观看数 */
    online: 0,
  };
  /** 主播信息 */
  public anchor: UserInfo = { name: "", id: 0 };
  /** 直播间弹幕api模块 */
  public client: ClientWithAbortController | null = null;
  /** 是否连接上服务器 */
  public connected: boolean = false;

  /** 直播间是否可用 */
  public available: boolean = false;

  /** 是否处于重连状态 */
  private reconnecting: boolean = false;
  /** 最后一次连接时间 */
  private lastConnectionTime = 0;

  /** 断线重连间隔 */
  public connectInterval: number;
  /** 连接超时阈值 */
  public connectTimeout: number;
  /** 自动重连 */
  public autoReconnect: boolean;

  /** 是否初始化 */
  public whenInit: Promise<RoomAcfun>;

  /** 连接凭证 */
  #tokens?: ConnectTokens | (LoginInfo & { did: string });
  /** 用户cookie */
  #cookies = new Cookies();
  /** 用户代理 */
  userAgent?: string;

  public giftList?: GiftList;

  /** 自定义fetchData */
  customFetchData?: (
    id: number | string
  ) => Promise<
    LiveRoomData & { availableTickets: string[]; enterRoomAttach: string }
  >;
  /** 自定义fetchTokens */
  customFetchTokens?: (id: number) => Promise<ConnectTokens>;
  /** 自定义fetchGiftList */
  customFetchGiftList?: (id: number) => Promise<GiftList>;

  /** 自定义fetch函数 */
  fetch: (
    input: RequestInfo | URL,
    init?: RequestInit | undefined
  ) => Promise<Response> = fetch;

  constructor(id: number, options: RoomOptions = {}) {
    super();
    this.id = id; // 直播间号
    this.connectInterval = options.connectInterval ?? 500;
    this.connectTimeout = options.connectTimeout ?? 45000;
    this.autoReconnect = options.autoReconnect ?? false;

    this.#tokens = options.tokens;
    this.#cookies = new Cookies<any>(options.credentials);
    this.anchor.id = id; // 主播uid
    options.data && this.setData(options.data);

    const init = options.init ?? true;
    if (init) {
      this.whenInit = this.init(options).then(() => this);
    } else {
      this.whenInit = new Promise((res) => res(this));
    }
  }
  /** 初始化 */
  protected async init(options: RoomOptions = {}) {
    const { tokens, open, data } = options;
    if (open) this.openStatus = 1;

    // 设置必要 cookie
    // 如果cookie中没有_did字段，会自动获取一个
    await this.setCredentials(this.#cookies.toString(), false);

    // 自动更新用户 tokens
    if (!tokens) await this.updateUserTokens();

    // 自动更新房间信息
    if (
      !(
        data &&
        (tokens as ConnectTokens)?.liveId &&
        (tokens as ConnectTokens).availableTickets &&
        (tokens as ConnectTokens).enterRoomAttach
      )
    ) {
      const { availableTickets, enterRoomAttach } = await this.update();
      this.#tokens = Object.assign({}, this.#tokens, {
        availableTickets,
        enterRoomAttach,
      });
    }

    // 自动获取礼物列表
    this.giftList = await this.fetchGiftList();

    if (open) {
      this.openWebsocketClient();
    }
    this.emit("init");
  }

  public async update() {
    const info = await this.fetchData();
    if (this.openStatus == 1) {
      this.liveId = info.liveId;
    }
    this.setData(info);
    return info;
  }

  async fetchData(): Promise<
    LiveRoomData & { availableTickets: string[]; enterRoomAttach: string }
  > {
    if (this.customFetchData) return this.customFetchData(this.id);
    const id = this.id;
    const { did, userId, st } = { ...(this.#tokens as ConnectTokens) };
    const isVisitor = userId >= 1000000000000000;
    const {
      liveId,
      caption,
      liveStartTime,
      availableTickets,
      enterRoomAttach,
    } = await getStartPlayInfo(
      {
        authorId: id,
        userId: userId,
        did: did,
        "acfun.midground.api_st": !isVisitor ? st : undefined,
        "acfun.api.visitor_st": isVisitor ? st : undefined,
      },
      this.#getFetchOptions()
    ).catch(() => ({
      liveId: "",
      caption: "",
      liveStartTime: 0,
      availableTickets: [] as string[],
      enterRoomAttach: "",
    }));
    const { profile } = await requestUserInfo(this.id, this.#getFetchOptions());

    return {
      platform: "acfun",
      id: id,
      key: `acfun:${id}`,
      liveId: liveId,
      detail: {
        title: caption,
        cover: liveId
          ? `https://tx2.a.kwimgs.com/bs2/ztlc/cover_${liveId}_raw.jpg`
          : undefined,
      },
      anchor: {
        id: id,
        name: profile.name,
        avatar: profile.headUrl,
      },
      status: liveId ? LiveRoomStatus.live : LiveRoomStatus.off,
      timestamp: liveStartTime,
      available: !!enterRoomAttach,
      connectionStatus: 0,
      openStatus: 0,
      opened: false,
      availableTickets,
      enterRoomAttach,
    };
  }

  async fetchGiftList() {
    if (this.customFetchGiftList) return this.customFetchGiftList(this.id);
    return getGiftList(
      { ...(this.#tokens as ConnectTokens), authorId: this.id },
      this.#getFetchOptions()
    ).catch(() => []);
  }

  /** 更新直播间信息 */
  setData({
    status,
    timestamp,
    detail,
    stats,
    anchor,
    liveId,
    available,
  }: LiveRoomData) {
    this.status = status;
    this.timestamp = timestamp;
    this.detail = detail;
    stats && (this.stats = stats);
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
    this.openStatus = 1;
    await this.update();
    this.openWebsocketClient();
  }

  /** 设置登录凭据 */
  async setCredentials(credentials: string, updateTokens = true) {
    const cookies = new Cookies<"_did">(credentials);
    if (!cookies.has("_did")) {
      cookies.append(
        await requestDidCookie({
          ...this.#getFetchOptions(),
          cookie: cookies.toString(),
        })
      );
    }
    this.#cookies = cookies;
    if (updateTokens) this.updateTokens();
  }
  /** 更新用户tokens */
  async updateUserTokens() {
    this.setTokens(await this.fetchUserTokens(this.#cookies.toString()));
  }

  /** 更新连接tokens */
  async updateTokens() {
    this.setTokens(await this.fetchTokens(this.#cookies.toString()));
  }

  /** 获取用户tokens */
  async fetchUserTokens(credentials: string = "") {
    const cookies = new Cookies<"_did" | "acPasstoken" | "auth_key">(
      credentials
    );
    const did = cookies.get("_did");
    const acPasstoken = cookies.get("acPasstoken");
    const auth_key = cookies.get("auth_key");

    // 如果存在 acPasstoken 和 auth_key，按登录模式获取token
    if (acPasstoken && auth_key) {
      const {
        "acfun.midground.api_st": st,
        userId,
        ssecurity: security,
      } = await requestTokenGet({ cookie: cookies.toString() });
      return { did, st, userId, security };
    } else {
      // 否则，按游客模式获取token
      const {
        "acfun.api.visitor_st": st,
        userId,
        acSecurity: security,
      } = await requestVisitorLogin({ cookie: cookies.toString() });
      return { did, st, userId, security };
    }
  }

  /** 获取tokens */
  async fetchTokens(credentials: string = ""): Promise<ConnectTokens> {
    const { did, st, userId, security } = await this.fetchUserTokens(
      credentials
    );
    const isVisitor = userId >= 1000000000000000;
    const { availableTickets, enterRoomAttach, liveId } =
      await getStartPlayInfo(
        {
          did,
          userId,
          authorId: this.id,
          "acfun.midground.api_st": !isVisitor ? st : undefined,
          "acfun.api.visitor_st": isVisitor ? st : undefined,
        },
        { ...this.#getFetchOptions(), cookie: credentials }
      );
    return {
      did,
      st,
      userId,
      security,
      availableTickets,
      enterRoomAttach,
      liveId,
    };
  }

  /** 重连 */
  /** 设置直播连接token */
  setTokens(tokens: ConnectTokens | (LoginInfo & { did: string })) {
    this.#tokens = tokens;
    if (this.opened) {
      // 如果已打开，则重连
      this.reconnect();
    }
  }
  reconnect() {
    // 如果正在重连，则返回
    if (this.reconnecting) return;
    this.reconnecting = true;
    const lastClient = this.client;
    if (!lastClient) return;
    this.initClient();
    // 重连成功后，关闭上一个连接
    this.client?.addEventListener(
      "open",
      () => {
        lastClient[symbolAbortController].abort();
        lastClient.close();
        this.reconnecting = false;
      },
      { once: true }
    );
  }

  /** 打开直播弹幕客户端 */
  private openWebsocketClient() {
    // 如果直播间不可用，则返回
    if (!this.available) {
      this.openStatus = 0;
      return;
    }
    this.initClient();
    this.openStatus = 2;
    this.emit("open");
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
  /** 初始化直播服务端监听 */
  private async initClient() {
    this.emitConnention(LiveConnectionStatus.connecting);

    // 与Websocket服务器连接
    const client = new AcClient({
      ...this.#tokens,
      liveId: this.liveId,
    } as ClientTokens) as ClientWithAbortController;

    const controller = new AbortController();
    const signal = controller.signal;
    client[symbolAbortController] = controller;

    client.addEventListener(
      "open",
      () => {
        this.emitConnention(LiveConnectionStatus.connected);
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
      "EnterRoomAck",
      () => {
        this.emitConnention(LiveConnectionStatus.entered);
      },
      { signal }
    );

    client.addEventListener(
      "StateSignal",
      (e) => {
        const { signalType, data } = e;
        const msg = parseMessage(signalType as any, data, this);
        msg && this.emitMessage(msg);
        this.emitRaw({ ...e });
      },
      { signal }
    );
    client.addEventListener(
      "ActionSignal",
      (e) => {
        const { signalType, data } = e;
        const msg = parseMessage(signalType as any, data, this, this.giftList);
        msg && this.emitMessage(msg);
        this.emitRaw({ ...e });
      },
      { signal }
    );
    client.addEventListener(
      "NotifySignal",
      (e) => {
        const { signalType, data } = e;
        const msg = parseMessage(signalType as any, data, this);
        msg && this.emitMessage(msg);
        this.emitRaw({ ...e });
      },
      { signal }
    );
    client.addEventListener(
      "StatusChanged",
      (e) => {
        const { data } = e;
        const msg = parseMessage("ZtLiveScStatusChanged", data, this);
        msg && this.emitMessage(msg);
        this.emitRaw({ ...e });
      },
      { signal }
    );
    this.client = client;
  }

  #getFetchOptions(): FetchOptions {
    return {
      fetch: this.fetch,
      userAgent: this.userAgent,
      cookie: this.#cookies.toString(),
    };
  }

  /** 关闭直播间监听 */
  close() {
    if (!this.opened) return;
    this.openStatus = 0;
    this.client?.wsClose();
    this.emitConnention(LiveConnectionStatus.off);
    this.emit("close");
  }
  destroy() {
    this.close();
  }
}

export default RoomAcfun;
