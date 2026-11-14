import { bilibili } from "./proto/index.js";

export const decode_INTERACT_WORD_V2 = (pb: string) => {
  return bilibili.live.xuserreward.v1.InteractWord.decode(
    base64ToUint8Array(pb)
  );
};

export const decode_ONLINE_RANK_V3 = (pb: string) => {
  return bilibili.live.rankdb.v1.GoldRankBroadcast.decode(
    base64ToUint8Array(pb)
  );
};


function base64ToUint8Array(base64String: string) {
  let padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  let base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");

  let rawData = atob(base64);
  let outputArray = new Uint8Array(rawData.length);

  for (var i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
