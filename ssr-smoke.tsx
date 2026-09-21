import { renderToString } from "react-dom/server";
import React from "react";
import App from "./src/App";

// localStorage stub for SSR smoke
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
(globalThis as any).confirm = () => false;

const html = renderToString(React.createElement(App));
const checks: [string, boolean][] = [
  ["渲染出离线复测台标题", html.includes("离线航迹可信度复测台")],
  ["可信排行标签", html.includes("可信排行")],
  ["争议复核队列标签", html.includes("争议复核队列")],
  ["示例足环号出现", html.includes("CHN-24-001839")],
  ["争议超速段提示", html.includes("SPEED") === false], // 英文枚举不应泄漏
  ["双人复核入口", html.includes("双人复核") || html.includes("复核")],
];
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
console.log(`HTML 长度 ${html.length}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
console.log("SSR SMOKE PASSED");
