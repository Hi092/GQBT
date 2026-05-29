/*
 * 广汽本田 诊断脚本
 * 用途：排查脚本无法运行的具体原因
 * 在 QX 中手动运行一次，把通知截图发我
 */

// ========== 存储兼容层 ==========
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

// 1. 检查运行环境
diag.push("平台: " + (typeof $task !== "undefined" ? "QX" : typeof $httpClient !== "undefined" ? "Surge/Loon" : "未知"));
diag.push("$notify: " + (typeof $notify));
diag.push("$task.fetch: " + (typeof ($task && $task.fetch)));
diag.push("$done: " + (typeof $done));

// 2. 检查存储的凭据
var token = Store.read("ghac_x_access_token");
var customerCode = Store.read("ghac_customer_code");
var deviceToken = Store.read("ghac_device_token");
var cookie = Store.read("ghac_cookie");
var lastRun = Store.read("ghac_last_run_date");

diag.push("token: " + (token ? ("有(" + token.length + "字符)") : "❌ 空"));
diag.push("customerCode: " + (customerCode ? ("有(" + customerCode.length + "字符)") : "❌ 空"));
diag.push("deviceToken: " + (deviceToken ? ("有(" + deviceToken.length + "字符)") : "空"));
diag.push("cookie: " + (cookie ? ("有(" + cookie.length + "字符)") : "空"));
diag.push("lastRun: " + (lastRun || "空"));

// 3. 如果有凭据，尝试测试接口
function testAPI() {
  if (!token || !customerCode) {
    diag.push("--- 无凭据，跳过接口测试 ---");
    finish();
    return;
  }

  var UA = "GHA-APP-AppStore/4.1.8 (iPhone; iOS 18.7.7; Scale/3.00)";
  var headers = {
    "User-Agent": UA,
    "Accept": "*/*",
    "os": "ios",
    "version": "4.1.8",
    "X-Access-Token": token,
    "customerCode": customerCode,
    "deviceToken": deviceToken || ""
  };
  if (cookie) { headers["Cookie"] = cookie; }

  var d = new Date();
  var pad = function(n) { return ("0" + n).slice(-2); };
  var monthStart = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-01 00:00:00";
  var daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  var monthEnd = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(daysInMonth) + " 00:00:00";

  diag.push("--- 测试签到接口 ---");

  $task.fetch({
    url: "https://gha.ghac.cn:8805/task/app/api/sign/find",
    method: "POST",
    headers: headers,
    body: JSON.stringify({
      startTime: monthStart,
      endTime: monthEnd,
      customerCode: customerCode
    })
  }).then(function(resp) {
    diag.push("签到接口状态码: " + resp.statusCode);
    diag.push("响应前200字: " + (resp.body || "").substring(0, 200));

    // 测试帖子接口
    diag.push("--- 测试帖子接口 ---");
    headers["referrerSource"] = encodeURIComponent("发现页");
    return $task.fetch({
      url: "https://gha.ghac.cn:8082/discover/app/api/circlecontent/page",
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        pageNo: "1", pageSize: 5, ids: "", sort: "1",
        themeId: "", customerCode: customerCode, seriesId: "",
        isGreat: "0", circleType: "", funLabelIds: [], timestamp: ""
      })
    });
  }).then(function(resp) {
    diag.push("帖子接口状态码: " + resp.statusCode);
    diag.push("响应前200字: " + (resp.body || "").substring(0, 200));
    finish();
  }).catch(function(err) {
    diag.push("接口请求异常: " + (typeof err === "string" ? err : JSON.stringify(err)));
    finish();
  });
}

function finish() {
  var report = diag.join("\n");
  console.log("[GHAC 诊断]\n" + report);
  $notify("广汽本田 · 诊断", "详细结果", report);
  $done();
}

testAPI();
