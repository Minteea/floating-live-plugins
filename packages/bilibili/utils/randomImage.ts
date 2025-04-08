// Generated by Deepseek

/** 生成随机的base64图片数据 */

export function generateRandomPngBase64(): string {
  // 生成带过滤头的随机像素数据
  const pixelData = new Uint8Array(20 * (20 * 4 + 1));
  for (let y = 0, offset = 0; y < 20; y++) {
    pixelData[offset++] = 0; // 过滤类型
    for (let x = 0; x < 20; x++) {
      pixelData[offset++] = Math.floor(Math.random() * 256); // R
      pixelData[offset++] = Math.floor(Math.random() * 256); // G
      pixelData[offset++] = Math.floor(Math.random() * 256); // B
      pixelData[offset++] = 255; // A
    }
  }

  // 计算Adler32校验和
  const computeAdler32 = (data: Uint8Array): number => {
    let s1 = 1,
      s2 = 0;
    for (const byte of data) {
      s1 = (s1 + byte) % 65521;
      s2 = (s2 + s1) % 65521;
    }
    return (s2 << 16) | s1;
  };

  // 构造Deflate流
  const deflateStream = new Uint8Array([
    0x78,
    0x01, // Zlib头
    0x00, // BFINAL=0，BTYPE=00（非最后块）
    0x54,
    0x06, // LEN=1620
    0xab,
    0xf9, // NLEN=~1620
    ...pixelData,
    ...new Uint8Array([
      // Adler32
      (computeAdler32(pixelData) >> 24) & 0xff,
      (computeAdler32(pixelData) >> 16) & 0xff,
      (computeAdler32(pixelData) >> 8) & 0xff,
      computeAdler32(pixelData) & 0xff,
    ]),
  ]);

  // 计算CRC32
  const computeCRC32 = (data: Uint8Array): number => {
    let crc = 0xffffffff;
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }
    for (const byte of data) {
      crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return crc ^ 0xffffffff;
  };

  // 创建PNG块
  const createChunk = (type: string, data: Uint8Array): Uint8Array => {
    const typeBytes = new TextEncoder().encode(type);
    const length = new Uint8Array(4);
    length[0] = (data.length >> 24) & 0xff;
    length[1] = (data.length >> 16) & 0xff;
    length[2] = (data.length >> 8) & 0xff;
    length[3] = data.length & 0xff;

    const chunkData = new Uint8Array([...typeBytes, ...data]);
    const crc = computeCRC32(chunkData);
    const crcBytes = new Uint8Array(4);
    crcBytes[0] = (crc >> 24) & 0xff;
    crcBytes[1] = (crc >> 16) & 0xff;
    crcBytes[2] = (crc >> 8) & 0xff;
    crcBytes[3] = crc & 0xff;

    return new Uint8Array([...length, ...chunkData, ...crcBytes]);
  };

  // 构建PNG结构
  const signature = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdrData = new Uint8Array([
    0x00,
    0x00,
    0x00,
    0x14, // 宽度20
    0x00,
    0x00,
    0x00,
    0x14, // 高度20
    0x08, // 位深度
    0x06, // 颜色类型（RGBA）
    0x00, // 压缩方法
    0x00, // 滤波方法
    0x00, // 隔行扫描
  ]);
  const ihdrChunk = createChunk("IHDR", ihdrData);
  const idatChunk = createChunk("IDAT", deflateStream);
  const iendChunk = createChunk("IEND", new Uint8Array(0));

  // 合并所有数据
  const pngData = new Uint8Array([
    ...signature,
    ...ihdrChunk,
    ...idatChunk,
    ...iendChunk,
  ]);

  // 转换为Base64
  const base64 = btoa(String.fromCharCode(...pngData));
  return `data:image/png;base64,${base64}`;
}
