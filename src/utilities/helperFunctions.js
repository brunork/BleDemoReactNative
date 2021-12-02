import { Buffer } from 'buffer';

global.Buffer = global.Buffer || require('buffer').Buffer

export function btoa(data) { return new Buffer(data, "binary").toString("base64"); } //encode
export function atob(data) { return new Buffer(data, "base64").toString("binary"); } //decode

export function base64ToArrayBuffer(base64) {
  const binary_string = atob(base64);
  const len = binary_string.length;
  console.log(len);
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

export function arrayToBase64(array) {
  return btoa(String.fromCharCode.apply(null, array));
}

export function concatArrayAndCommand(command, array) {
  const newArray = new Uint8Array(18);
  newArray[0] = command[0]
  newArray[1] = command[1]
  for (let i = 2; i < 18; i++) {
    newArray[i] = array[i - 2]
  }
  return newArray
}