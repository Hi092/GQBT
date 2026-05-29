/*
 * 广汽本田 深度诊断 - 测试不同端口和请求格式
 */

var Store = {
  read: function(key) {
    try {
      if (typeof $persistentStore !== "undefined" && $persistentStore && $persistentStore.read) {
        return $persistentStore.read(key);
      }
      if (typeof $prefs !== "undefined" && $prefs && $prefs.valueForKey) {
        return $prefs.valueForKey(key);
      }
    } catch (e) { return null; }
    return null;
  }
};

var diag = [];
var token = Store.read("ghac_x_access_token") || "";
var customerCode = Store.read("ghac_customer_code") || "";
var deviceToken = Store.read("ghac_device_token") || "";
var cookie = Store.read("ghac_cookie") || "";

diag.push("token长度: " + token.length);
diag.push("customerCode: " + customerCode);
diag.push("token前20: " + token.substring(0, 20));

var UA = "GHA-APP-AppStore/4.1.8 (iPhone; iOS 18.7.7; Scale/3.00)";
var d = new Date();
var pad = function(n) { return ("0" + n).slice(-2); };
var monthStart = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-01 00:00:00";
var daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
var monthEnd = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(daysInMonth) + " 00:00:00";

// 测试1: 8805端口 sign/find
var h1 = {
  "User-Agent": UA,
  "Accept": "*/*",
  "Accept-Language": "zh-Hans-US;q=1, en-US;q=0.9",
  "os": "ios",
  "modelType": "0",
  "version": "4.1.8",
  "systemVersion": "18.7.7",
  "X-Access-Token": token,
  "customerCode": customerCode,
  "deviceToken": deviceToken,
  "Content-Type": "application/json"
};
if (cookie) { h1["Cookie"] = cookie; }

var body1 = JSON.stringify({
  startTime: monthStart,
  endTime: monthEnd,
  customerCode: customerCode
});

diag.push("--- 测试1: sign/find (8805) ---");
diag.push("请求体: " + body1);

$task.fetch({
  url: "https://gha.ghac.cn:8805/task/app/api/sign/find",
  method: "POST",
  headers: h1,
  body: body1
}).then(function(resp) {
  diag.push("状态码: " + resp.statusCode);
  diag.push("完整响应: " + (resp.body || "").substring(0, 500));

  // 测试2: sign/save (GET)
  diag.push("--- 测试2: sign/save (8805 GET) ---");
  return $task.fetch({
    url: "https://gha.ghac.cn:8805/task/app/api/sign/save",
    method: "GET",
    headers: h1
  });
}).then(function(resp) {
  diag.push("状态码: " + resp.statusCode);
  diag.push("完整响应: " + (resp.body || "").substring(0, 500));

  // 测试3: 8082端口 帖子列表
  diag.push("--- 测试3: circlecontent/page (8082) ---");
  var h2 = {};
  for (var k in h1) { h2[k] = h1[k]; }
  h2["referrerSource"] = encodeURIComponent("发现页");
  return $task.fetch({
    url: "https://gha.ghac.cn:8082/discover/app/api/circlecontent/page",
    method: "POST",
    headers: h2,
    body: JSON.stringify({
      pageNo: "1", pageSize: 5, ids: "", sort: "1",
      themeId: "", customerCode: customerCode, seriesId: "",
      isGreat: "0", circleType: "", funLabelIds: [], timestamp: ""
    })
  });
}).then(function(resp) {
  diag.push("状态码: " + resp.statusCode);
  diag.push("完整响应: " + (resp.body || "").substring(0, 500));

  // 测试4: 8081端口 用户信息
  diag.push("--- 测试4: customer/find (8081) ---");
  return $task.fetch({
    url: "https://gha.ghac.cn:8081/base/app/api/customer/find?customerCode=" + customerCode,
    method: "GET",
    headers: h1
  });
}).then(function(resp) {
  diag.push("状态码: " + resp.statusCode);
  diag.push("完整响应: " + (resp.body || "").substring(0, 500));
  finish();
}).catch(function(err) {
  diag.push("异常: " + (typeof err === "string" ? err : JSON.stringify(err)));
  finish();
});

function finish() {
  var report = diag.join("\n");
  console.log("[GHAC 深度诊断]\n" + report);
  $notify("广汽本田 · 深度诊断", "完整结果", report);
  $done();
}
