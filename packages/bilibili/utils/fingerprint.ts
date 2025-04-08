import { x64hash128 } from "./fp2";
import { generateRandomPngBase64 } from "./randomImage";

interface FpInfoMap {
  userAgent: string;
  webdriver: boolean;
  language: string;
  colorDepth: number;
  deviceMemory: number;
  hardwareConcurrency: number;
  screenResolution: [number, number];
  availableScreenResolution: [number, number];
  timezoneOffset: number;
  timezone: string;
  sessionStorage: boolean;
  localStorage: boolean;
  indexedDb: boolean;
  addBehavior: boolean;
  openDatabase: boolean;
  cpuClass: string;
  platform: string;
  plugins: [string, string, [string, string][]][];
  canvas: [string, string];
  webgl: string[];
  webglVendorAndRenderer: string;
  hasLiedLanguages: boolean;
  hasLiedResolution: boolean;
  hasLiedOs: boolean;
  hasLiedBrowser: boolean;
  touchSupport: [number, boolean, boolean];
  fonts: string[];
  audio: string;
}

type FpItem<K extends keyof FpInfoMap> = { key: K; value: FpInfoMap[K] };

export type FpInfo = FpItem<keyof FpInfoMap>[];

export function fpGet<K extends keyof FpInfoMap>(fp: FpInfo, key: K) {
  return fp.find((item) => item.key == key)?.value as FpInfoMap[K];
}

export function getExClimbWuzhiPayload(
  fp: FpInfo,
  info: {
    uuid: string;
    timestamp: string; // ms
    browser_resolution: string; // 1920x1080
    abtest: string;
  }
) {
  const timestamp = info.timestamp;

  const userAgent = fpGet(fp, "userAgent");
  const webdriver = Number(!!fpGet(fp, "webdriver"));
  const language = fpGet(fp, "language");
  const colorDepth = fpGet(fp, "colorDepth");
  const deviceMemory = fpGet(fp, "deviceMemory");
  const hardwareConcurrency = fpGet(fp, "hardwareConcurrency");
  const screenResolution = fpGet(fp, "screenResolution");
  const availableScreenResolution = fpGet(fp, "availableScreenResolution");
  const timezoneOffset = fpGet(fp, "timezoneOffset");
  const timezone = fpGet(fp, "timezone");
  const sessionStorage = Number(!!fpGet(fp, "sessionStorage"));
  const localStorage = Number(!!fpGet(fp, "localStorage"));
  const indexedDb = Number(!!fpGet(fp, "indexedDb"));
  const addBehavior = Number(!!fpGet(fp, "addBehavior"));
  const openDatabase = Number(!!fpGet(fp, "openDatabase"));
  const cpuClass = fpGet(fp, "cpuClass");
  const platform = fpGet(fp, "platform");
  const plugins = fpGet(fp, "plugins");
  const canvas = fpGet(fp, "canvas");
  const webgl = fpGet(fp, "webgl");
  const webglVendorAndRenderer = fpGet(fp, "webglVendorAndRenderer");
  const hasLiedLanguages = Number(!!fpGet(fp, "hasLiedLanguages"));
  const hasLiedResolution = Number(!!fpGet(fp, "hasLiedResolution"));
  const hasLiedOs = Number(!!fpGet(fp, "hasLiedOs"));
  const hasLiedBrowser = Number(!!fpGet(fp, "hasLiedBrowser"));
  const touchSupport = fpGet(fp, "touchSupport").map((n) => Number(!!n));
  const fonts = fpGet(fp, "fonts");
  const audio = fpGet(fp, "audio");

  const canvas_str = canvas[1].substring(canvas[1].length - 20);
  const webgl_str = webgl[0].substring(webgl[0].length - 50);
  const webgl_params = webgl.slice(1);

  return {
    "3064": 1, // ptype, mobile => 2, others => 1
    "5062": timestamp, // timestamp (ms)
    "03bf": "https%3A%2F%2Fwww.bilibili.com%2F", // url accessed
    "39c8": "333.1007.fp.risk", // spm_id
    "34f1": "", // target_url, default empty now
    d402: "", // screenx, default empty
    "654a": "", // screeny, default empty
    "6e7c": info.browser_resolution, // browser_resolution, window.innerWidth || document.body && document.body.clientWidth + "x" + window.innerHeight || document.body && document.body.clientHeight
    "3c43": {
      // 3c43 => msg
      "2673": 0, // hasLiedResolution, window.screen.width < window.screen.availWidth || window.screen.height < window.screen.availHeight
      "5766": colorDepth, // colorDepth, window.screen.colorDepth
      "6527": 0, // addBehavior, !!window.HTMLElement.prototype.addBehavior, html5 api
      "7003": 1, // indexedDb, !!window.indexedDB, html5 api
      "807e": 1, // cookieEnabled, navigator.cookieEnabled
      b8ce: userAgent, // ua
      "641c": webdriver, // webdriver, navigator.webdriver, like Selenium
      "07a4": language, // language
      "1c57": deviceMemory, // deviceMemory in GB, navigator.deviceMemory
      "0bd0": hardwareConcurrency, // hardwareConcurrency, navigator.hardwareConcurrency
      "748e": screenResolution, // screenResolution
      d61f: availableScreenResolution, // availableScreenResolution
      fc9d: timezoneOffset, // timezoneOffset, (new Date).getTimezoneOffset()
      "6aa9": timezone, // timezone, (new window.Intl.DateTimeFormat).resolvedOptions().timeZone
      "75b8": sessionStorage, // sessionStorage, window.sessionStorage, html5 api
      "3b21": localStorage, // localStorage, window.localStorage, html5 api
      "8a1c": openDatabase, // openDatabase, window.openDatabase, html5 api
      d52f: cpuClass, // cpuClass, navigator.cpuClass
      adca: platform, // platform, navigator.platform
      "80c9": plugins, // plugins
      "13ab": canvas_str, // canvas fingerprint
      bfe9: webgl_str, // webgl_str
      a3c1: webgl_params, // webgl_params, cab be set to [] if webgl is not supported
      "6bc5": webglVendorAndRenderer, // webglVendorAndRenderer
      ed31: hasLiedLanguages, // hasLiedLanguages
      "72bd": hasLiedOs, // hasLiedOs
      "097b": hasLiedBrowser, // hasLiedBrowser
      "52cd": touchSupport, // touch support
      a658: fonts, // font details. see https://github.com/fingerprintjs/fingerprintjs for implementation details
      d02f: audio, // audio fingerprint. see https://github.com/fingerprintjs/fingerprintjs for implementation details
    },
    "54ef": info.abtest, // abtest info, embedded in html
    "8b94": "", // refer_url, document.referrer ? encodeURIComponent(document.referrer).substr(0, 1e3) : ""
    df35: info.uuid, // _uuid, set from cookie, generated by client side(algorithm remains unknown)
    "07a4": "zh-CN", // language
    "5f45": null, // laboratory, set from cookie, null if empty, source remains unknown
    db46: 0, // is_selfdef, default 0}
  };
}

/** 生成虚拟指纹信息 */
export function generateFakeFpInfo(info: {
  canvas: string;
  webgl: string;
  userAgent: string;
  platform: string;
}): FpInfo {
  const { canvas, webgl, userAgent } = info;
  return [
    {
      key: "userAgent",
      value: userAgent,
    },
    {
      key: "webdriver",
      value: false,
    },
    {
      key: "language",
      value: "zh-CN",
    },
    {
      key: "colorDepth",
      value: 24,
    },
    {
      key: "deviceMemory",
      value: 8,
    },
    {
      key: "hardwareConcurrency",
      value: 12,
    },
    {
      key: "screenResolution",
      value: [1920, 1080],
    },
    {
      key: "availableScreenResolution",
      value: [1920, 1032],
    },
    {
      key: "timezoneOffset",
      value: new Date().getTimezoneOffset(),
    },
    {
      key: "timezone",
      value: new Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    {
      key: "sessionStorage",
      value: true,
    },
    {
      key: "localStorage",
      value: true,
    },
    {
      key: "indexedDb",
      value: true,
    },
    {
      key: "addBehavior",
      value: false,
    },
    {
      key: "openDatabase",
      value: false,
    },
    {
      key: "cpuClass",
      value: "not available",
    },
    {
      key: "platform",
      value: "Win32",
    },
    {
      key: "plugins",
      value: [
        [
          "PDF Viewer",
          "Portable Document Format",
          [
            ["application/pdf", "pdf"],
            ["text/pdf", "pdf"],
          ],
        ],
        [
          "Chrome PDF Viewer",
          "Portable Document Format",
          [
            ["application/pdf", "pdf"],
            ["text/pdf", "pdf"],
          ],
        ],
        [
          "Chromium PDF Viewer",
          "Portable Document Format",
          [
            ["application/pdf", "pdf"],
            ["text/pdf", "pdf"],
          ],
        ],
        [
          "Microsoft Edge PDF Viewer",
          "Portable Document Format",
          [
            ["application/pdf", "pdf"],
            ["text/pdf", "pdf"],
          ],
        ],
        [
          "WebKit built-in PDF",
          "Portable Document Format",
          [
            ["application/pdf", "pdf"],
            ["text/pdf", "pdf"],
          ],
        ],
      ],
    },
    {
      key: "canvas",
      value: ["canvas winding:yes", `canvas fp:${canvas}`],
    },
    {
      key: "webgl",
      value: [
        webgl,
        "extensions:ANGLE_instanced_arrays;EXT_blend_minmax;EXT_clip_control;EXT_color_buffer_half_float;EXT_depth_clamp;EXT_disjoint_timer_query;EXT_float_blend;EXT_frag_depth;EXT_polygon_offset_clamp;EXT_shader_texture_lod;EXT_texture_compression_bptc;EXT_texture_compression_rgtc;EXT_texture_filter_anisotropic;EXT_texture_mirror_clamp_to_edge;EXT_sRGB;KHR_parallel_shader_compile;OES_element_index_uint;OES_fbo_render_mipmap;OES_standard_derivatives;OES_texture_float;OES_texture_float_linear;OES_texture_half_float;OES_texture_half_float_linear;OES_vertex_array_object;WEBGL_blend_func_extended;WEBGL_color_buffer_float;WEBGL_compressed_texture_s3tc;WEBGL_compressed_texture_s3tc_srgb;WEBGL_debug_renderer_info;WEBGL_debug_shaders;WEBGL_depth_texture;WEBGL_draw_buffers;WEBGL_lose_context;WEBGL_multi_draw;WEBGL_polygon_mode",
        "webgl aliased line width range:[1, 1]",
        "webgl aliased point size range:[1, 1024]",
        "webgl alpha bits:8",
        "webgl antialiasing:yes",
        "webgl blue bits:8",
        "webgl depth bits:24",
        "webgl green bits:8",
        "webgl max anisotropy:16",
        "webgl max combined texture image units:32",
        "webgl max cube map texture size:16384",
        "webgl max fragment uniform vectors:1024",
        "webgl max render buffer size:16384",
        "webgl max texture image units:16",
        "webgl max texture size:16384",
        "webgl max varying vectors:30",
        "webgl max vertex attribs:16",
        "webgl max vertex texture image units:16",
        "webgl max vertex uniform vectors:4095",
        "webgl max viewport dims:[32767, 32767]",
        "webgl red bits:8",
        "webgl renderer:WebKit WebGL",
        "webgl shading language version:WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)",
        "webgl stencil bits:0",
        "webgl vendor:WebKit",
        "webgl version:WebGL 1.0 (OpenGL ES 2.0 Chromium)",
        "webgl unmasked vendor:Google Inc. (NVIDIA)",
        "webgl unmasked renderer:ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 Super with Max-Q Design (0x00001ED1) Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "webgl vertex shader high float precision:23",
        "webgl vertex shader high float precision rangeMin:127",
        "webgl vertex shader high float precision rangeMax:127",
        "webgl vertex shader medium float precision:23",
        "webgl vertex shader medium float precision rangeMin:127",
        "webgl vertex shader medium float precision rangeMax:127",
        "webgl vertex shader low float precision:23",
        "webgl vertex shader low float precision rangeMin:127",
        "webgl vertex shader low float precision rangeMax:127",
        "webgl fragment shader high float precision:23",
        "webgl fragment shader high float precision rangeMin:127",
        "webgl fragment shader high float precision rangeMax:127",
        "webgl fragment shader medium float precision:23",
        "webgl fragment shader medium float precision rangeMin:127",
        "webgl fragment shader medium float precision rangeMax:127",
        "webgl fragment shader low float precision:23",
        "webgl fragment shader low float precision rangeMin:127",
        "webgl fragment shader low float precision rangeMax:127",
        "webgl vertex shader high int precision:0",
        "webgl vertex shader high int precision rangeMin:31",
        "webgl vertex shader high int precision rangeMax:30",
        "webgl vertex shader medium int precision:0",
        "webgl vertex shader medium int precision rangeMin:31",
        "webgl vertex shader medium int precision rangeMax:30",
        "webgl vertex shader low int precision:0",
        "webgl vertex shader low int precision rangeMin:31",
        "webgl vertex shader low int precision rangeMax:30",
        "webgl fragment shader high int precision:0",
        "webgl fragment shader high int precision rangeMin:31",
        "webgl fragment shader high int precision rangeMax:30",
        "webgl fragment shader medium int precision:0",
        "webgl fragment shader medium int precision rangeMin:31",
        "webgl fragment shader medium int precision rangeMax:30",
        "webgl fragment shader low int precision:0",
        "webgl fragment shader low int precision rangeMin:31",
        "webgl fragment shader low int precision rangeMax:30",
      ],
    },
    {
      key: "webglVendorAndRenderer",
      value:
        "Google Inc. (NVIDIA)~ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 Super with Max-Q Design (0x00001ED1) Direct3D11 vs_5_0 ps_5_0, D3D11)",
    },
    {
      key: "hasLiedLanguages",
      value: false,
    },
    {
      key: "hasLiedResolution",
      value: false,
    },
    {
      key: "hasLiedOs",
      value: false,
    },
    {
      key: "hasLiedBrowser",
      value: false,
    },
    {
      key: "touchSupport",
      value: [0, false, false],
    },
    {
      key: "fonts",
      value: [
        "Arial",
        "Arial Black",
        "Arial Narrow",
        "Arial Unicode MS",
        "Book Antiqua",
        "Bookman Old Style",
        "Calibri",
        "Cambria",
        "Cambria Math",
        "Century",
        "Century Gothic",
        "Century Schoolbook",
        "Comic Sans MS",
        "Consolas",
        "Courier",
        "Courier New",
        "Georgia",
        "Helvetica",
        "Impact",
        "Lucida Bright",
        "Lucida Calligraphy",
        "Lucida Console",
        "Lucida Fax",
        "Lucida Handwriting",
        "Lucida Sans",
        "Lucida Sans Typewriter",
        "Lucida Sans Unicode",
        "Microsoft Sans Serif",
        "Monotype Corsiva",
        "MS Gothic",
        "MS PGothic",
        "MS Reference Sans Serif",
        "MS Sans Serif",
        "MS Serif",
        "Palatino Linotype",
        "Segoe Print",
        "Segoe Script",
        "Segoe UI",
        "Segoe UI Light",
        "Segoe UI Semibold",
        "Segoe UI Symbol",
        "Tahoma",
        "Times",
        "Times New Roman",
        "Trebuchet MS",
        "Verdana",
        "Wingdings",
        "Wingdings 2",
        "Wingdings 3",
      ],
    },
    {
      key: "audio",
      value: "124.04347527516074",
    },
  ];
}

const fpInfo = generateFakeFpInfo({
  canvas: generateRandomPngBase64(),
  webgl: generateRandomPngBase64(),
  platform: "Win32",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0",
});

export const mockFpInfo: FpInfo = [
  {
    key: "userAgent",
    value:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0",
  },
  {
    key: "webdriver",
    value: false,
  },
  {
    key: "language",
    value: "zh-CN",
  },
  {
    key: "colorDepth",
    value: 24,
  },
  {
    key: "deviceMemory",
    value: 8,
  },
  {
    key: "hardwareConcurrency",
    value: 12,
  },
  {
    key: "screenResolution",
    value: [1920, 1080],
  },
  {
    key: "availableScreenResolution",
    value: [1920, 1032],
  },
  {
    key: "timezoneOffset",
    value: -480,
  },
  {
    key: "timezone",
    value: "Etc/GMT-8",
  },
  {
    key: "sessionStorage",
    value: true,
  },
  {
    key: "localStorage",
    value: true,
  },
  {
    key: "indexedDb",
    value: true,
  },
  {
    key: "addBehavior",
    value: false,
  },
  {
    key: "openDatabase",
    value: false,
  },
  {
    key: "cpuClass",
    value: "not available",
  },
  {
    key: "platform",
    value: "Win32",
  },
  {
    key: "plugins",
    value: [
      [
        "PDF Viewer",
        "Portable Document Format",
        [
          ["application/pdf", "pdf"],
          ["text/pdf", "pdf"],
        ],
      ],
      [
        "Chrome PDF Viewer",
        "Portable Document Format",
        [
          ["application/pdf", "pdf"],
          ["text/pdf", "pdf"],
        ],
      ],
      [
        "Chromium PDF Viewer",
        "Portable Document Format",
        [
          ["application/pdf", "pdf"],
          ["text/pdf", "pdf"],
        ],
      ],
      [
        "Microsoft Edge PDF Viewer",
        "Portable Document Format",
        [
          ["application/pdf", "pdf"],
          ["text/pdf", "pdf"],
        ],
      ],
      [
        "WebKit built-in PDF",
        "Portable Document Format",
        [
          ["application/pdf", "pdf"],
          ["text/pdf", "pdf"],
        ],
      ],
    ],
  },
  {
    key: "canvas",
    value: [
      "canvas winding:yes",
      "canvas fp:data:image/png;base64,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AgQIECBAgACBJgICepNDWoMAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIEagICes3PNAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAg0ERDQmxzSGgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBQExDQa36mCRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQKCJgIDe5JDWIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIGagIBe8zNNgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAk0EBPQmh7QGAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECNQEBPSan2kCBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQaCIgoDc5pDUIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAoCYgoNf8TBMgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIBAEwEBvckhrUGAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECNQEBveZnmgABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgSaCAjoTQ5pDQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBCoCQjoNT/TBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQINBEQEBvckhrECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgEBNQECv+ZkmQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAgSYCAnqTQ1qDAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBGoCAnrNzzQBAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQINBEQ0Jsc0hoECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgUBMQ0Gt+pgkQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECgiYCA3uSQ1iBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgACBmoCAXvMzTYAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJNBAT0Joe0BgECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAjUBAT0mp9pAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIEGgiIKA3OaQ1CBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQKAmIKDX/EwTIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAQBMBAb3JIa1BgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAjUBAb3mZ5oAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIEmggI6E0OaQ0CBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQqAkI6DU/0wQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECDQREBAb3JIaxAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIBATUBAr/mZJkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEmAgJ6k0Na4VBPVgAAAfhJREFUgwABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgRqAgJ6zc80AQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECDQRENCbHNIaBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIFATENBrfqYJECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAoImAgN7kkNYgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAgZqAgF7zM02AAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECTQQE9CaHtAYBAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQI1AQE9JqfaQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBBoIiCgNzmkNQgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECgJiCg1/xMEyBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgEATAQG9ySGtQYAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQI1AQG95meaAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBJoICOhNDmkNAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIEKgJ/AXz1WttISgStgAAAABJRU5ErkJggg==",
    ],
  },
  {
    key: "webgl",
    value: [
      "data:image/png;base64,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",
      "extensions:ANGLE_instanced_arrays;EXT_blend_minmax;EXT_clip_control;EXT_color_buffer_half_float;EXT_depth_clamp;EXT_disjoint_timer_query;EXT_float_blend;EXT_frag_depth;EXT_polygon_offset_clamp;EXT_shader_texture_lod;EXT_texture_compression_bptc;EXT_texture_compression_rgtc;EXT_texture_filter_anisotropic;EXT_texture_mirror_clamp_to_edge;EXT_sRGB;KHR_parallel_shader_compile;OES_element_index_uint;OES_fbo_render_mipmap;OES_standard_derivatives;OES_texture_float;OES_texture_float_linear;OES_texture_half_float;OES_texture_half_float_linear;OES_vertex_array_object;WEBGL_blend_func_extended;WEBGL_color_buffer_float;WEBGL_compressed_texture_s3tc;WEBGL_compressed_texture_s3tc_srgb;WEBGL_debug_renderer_info;WEBGL_debug_shaders;WEBGL_depth_texture;WEBGL_draw_buffers;WEBGL_lose_context;WEBGL_multi_draw;WEBGL_polygon_mode",
      "webgl aliased line width range:[1, 1]",
      "webgl aliased point size range:[1, 1024]",
      "webgl alpha bits:8",
      "webgl antialiasing:yes",
      "webgl blue bits:8",
      "webgl depth bits:24",
      "webgl green bits:8",
      "webgl max anisotropy:16",
      "webgl max combined texture image units:32",
      "webgl max cube map texture size:16384",
      "webgl max fragment uniform vectors:1024",
      "webgl max render buffer size:16384",
      "webgl max texture image units:16",
      "webgl max texture size:16384",
      "webgl max varying vectors:30",
      "webgl max vertex attribs:16",
      "webgl max vertex texture image units:16",
      "webgl max vertex uniform vectors:4095",
      "webgl max viewport dims:[32767, 32767]",
      "webgl red bits:8",
      "webgl renderer:WebKit WebGL",
      "webgl shading language version:WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)",
      "webgl stencil bits:0",
      "webgl vendor:WebKit",
      "webgl version:WebGL 1.0 (OpenGL ES 2.0 Chromium)",
      "webgl unmasked vendor:Google Inc. (NVIDIA)",
      "webgl unmasked renderer:ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 Super with Max-Q Design (0x00001ED1) Direct3D11 vs_5_0 ps_5_0, D3D11)",
      "webgl vertex shader high float precision:23",
      "webgl vertex shader high float precision rangeMin:127",
      "webgl vertex shader high float precision rangeMax:127",
      "webgl vertex shader medium float precision:23",
      "webgl vertex shader medium float precision rangeMin:127",
      "webgl vertex shader medium float precision rangeMax:127",
      "webgl vertex shader low float precision:23",
      "webgl vertex shader low float precision rangeMin:127",
      "webgl vertex shader low float precision rangeMax:127",
      "webgl fragment shader high float precision:23",
      "webgl fragment shader high float precision rangeMin:127",
      "webgl fragment shader high float precision rangeMax:127",
      "webgl fragment shader medium float precision:23",
      "webgl fragment shader medium float precision rangeMin:127",
      "webgl fragment shader medium float precision rangeMax:127",
      "webgl fragment shader low float precision:23",
      "webgl fragment shader low float precision rangeMin:127",
      "webgl fragment shader low float precision rangeMax:127",
      "webgl vertex shader high int precision:0",
      "webgl vertex shader high int precision rangeMin:31",
      "webgl vertex shader high int precision rangeMax:30",
      "webgl vertex shader medium int precision:0",
      "webgl vertex shader medium int precision rangeMin:31",
      "webgl vertex shader medium int precision rangeMax:30",
      "webgl vertex shader low int precision:0",
      "webgl vertex shader low int precision rangeMin:31",
      "webgl vertex shader low int precision rangeMax:30",
      "webgl fragment shader high int precision:0",
      "webgl fragment shader high int precision rangeMin:31",
      "webgl fragment shader high int precision rangeMax:30",
      "webgl fragment shader medium int precision:0",
      "webgl fragment shader medium int precision rangeMin:31",
      "webgl fragment shader medium int precision rangeMax:30",
      "webgl fragment shader low int precision:0",
      "webgl fragment shader low int precision rangeMin:31",
      "webgl fragment shader low int precision rangeMax:30",
    ],
  },
  {
    key: "webglVendorAndRenderer",
    value:
      "Google Inc. (NVIDIA)~ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 Super with Max-Q Design (0x00001ED1) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  },
  {
    key: "hasLiedLanguages",
    value: false,
  },
  {
    key: "hasLiedResolution",
    value: false,
  },
  {
    key: "hasLiedOs",
    value: false,
  },
  {
    key: "hasLiedBrowser",
    value: false,
  },
  {
    key: "touchSupport",
    value: [0, false, false],
  },
  {
    key: "fonts",
    value: [
      "Arial",
      "Arial Black",
      "Arial Narrow",
      "Arial Unicode MS",
      "Book Antiqua",
      "Bookman Old Style",
      "Calibri",
      "Cambria",
      "Cambria Math",
      "Century",
      "Century Gothic",
      "Century Schoolbook",
      "Comic Sans MS",
      "Consolas",
      "Courier",
      "Courier New",
      "Georgia",
      "Helvetica",
      "Impact",
      "Lucida Bright",
      "Lucida Calligraphy",
      "Lucida Console",
      "Lucida Fax",
      "Lucida Handwriting",
      "Lucida Sans",
      "Lucida Sans Typewriter",
      "Lucida Sans Unicode",
      "Microsoft Sans Serif",
      "Monotype Corsiva",
      "MS Gothic",
      "MS PGothic",
      "MS Reference Sans Serif",
      "MS Sans Serif",
      "MS Serif",
      "Palatino Linotype",
      "Segoe Print",
      "Segoe Script",
      "Segoe UI",
      "Segoe UI Light",
      "Segoe UI Semibold",
      "Segoe UI Symbol",
      "Tahoma",
      "Times",
      "Times New Roman",
      "Trebuchet MS",
      "Verdana",
      "Wingdings",
      "Wingdings 2",
      "Wingdings 3",
    ],
  },
  {
    key: "audio",
    value: "124.04347527516074",
  },
];
