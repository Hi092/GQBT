/*
 * 广汽本田 APP 凭据自动捕获脚本
 * 平台：Quantumult X
 * 功能：拦截发往 gha.ghac.cn:8805 的请求，提取并存储鉴权信息
 * 作者：Hi092
 */

// 防止手动运行时报错
if (typeof $request === "undefined" || !$request || !$request.url) {
  $done({});
  return;
}

var url = $request.url;
var headers = $request.headers || {};
var body = $request.body || "";

// 检查是否为目标域名
if (url.indexOf("gha.ghac.cn:8805") < 0) {
  $done({});
  return;
}

// ========== 工具函数 ==========

// 大小写不敏感获取 header
function getHeader(headers, name) {
  var lower = name.toLowerCase();
  var keys = Object.keys(headers);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === lower) {
      return headers[keys[i]];
    }
  }
  return null;
}

// Token 脱敏显示（前4后4）
function maskToken(token) {
  if (!token || token.length <= 10) {
    return token || "无";
  }
  return token.substring(0, 4) + "****" + token.substring(token.length - 4);
}

// 格式化当前时间
function formatNow() {
  var d = new Date();
  var pad = function(n) { return ("0" + n).slice(-2); };
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

// ========== 提取凭据 ==========

var token = getHeader(headers, "X-Access-Token") || "";
var customerCode = getHeader(headers, "customerCode") || "";
var deviceToken = getHeader(headers, "deviceToken") || "";
var cookie = getHeader(headers, "Cookie") || "";
var userAgent = getHeader(headers, "User-Agent") || "";

// 尝试从请求体中提取 customerCode / deviceToken（POST body）
if (body && body.length > 0) {
  try {
    var bodyObj = JSON.parse(body);
    if (!customerCode && bodyObj.customerCode) {
      customerCode = bodyObj.customerCode;
    }
    if (!deviceToken && bodyObj.deviceToken) {
      deviceToken = bodyObj.deviceToken;
    }
  } catch (e) {
    // body 不是 JSON，忽略
  }
}

// ========== 检查是否有更新 ==========

var changed = false;
var changeLog = [];

var storeToken = $persistentStore.read("ghac_x_access_token") || "";
var storeCustomer = $persistentStore.read("ghac_customer_code") || "";
var storeDevice = $persistentStore.read("ghac_device_token") || "";
var storeCookie = $persistentStore.read("ghac_cookie") || "";
var storeUA = $persistentStore.read("ghac_user_agent") || "";

if (token && token !== storeToken) {
  $persistentStore.write(token, "ghac_x_access_token");
  changed = true;
  changeLog.push("Token");
}
if (customerCode && customerCode !== storeCustomer) {
  $persistentStore.write(customerCode, "ghac_customer_code");
  changed = true;
  changeLog.push("CustomerCode");
}
if (deviceToken && deviceToken !== storeDevice) {
  $persistentStore.write(deviceToken, "ghac_device_token");
  changed = true;
  changeLog.push("DeviceToken");
}
if (cookie && cookie !== storeCookie) {
  $persistentStore.write(cookie, "ghac_cookie");
  changed = true;
  changeLog.push("Cookie");
}
if (userAgent && userAgent !== storeUA) {
  $persistentStore.write(userAgent, "ghac_user_agent");
  changed = true;
  changeLog.push("UA");
}

// ========== 通知 ==========

if (changed) {
  var now = formatNow();
  $persistentStore.write(now, "ghac_credential_updated_at");

  var detail = "更新项: " + changeLog.join(", ") + "\n" +
    "Token: " + maskToken(token) + "\n" +
    "CustomerCode: " + (customerCode || "未获取") + "\n" +
    "DeviceToken: " + maskToken(deviceToken) + "\n" +
    "更新时间: " + now;

  console.log("[GHAC] 凭据已更新: " + changeLog.join(", "));
  $notify("广汽本田", "🔑 凭据已更新", detail);
}

$done({});
