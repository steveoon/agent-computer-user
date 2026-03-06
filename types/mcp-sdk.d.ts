/**
 * @modelcontextprotocol/sdk 子路径类型声明
 *
 * SDK 的 package.json exports 使用通配符 "./*"，
 * 但缺少 "types" 条件，导致 tsc 无法解析深层子路径的类型。
 * 此声明文件为实际使用的子路径提供类型映射。
 *
 * @see https://github.com/modelcontextprotocol/typescript-sdk/issues/TODO
 */
declare module "@modelcontextprotocol/sdk/client/stdio" {
  export {
    StdioClientTransport,
    StdioServerParameters,
    DEFAULT_INHERITED_ENV_VARS,
    getDefaultEnvironment,
  } from "@modelcontextprotocol/sdk/dist/esm/client/stdio.js";
}
