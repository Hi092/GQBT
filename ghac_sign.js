/*
 * 广汽本田 APP 自动签到 + 日常任务脚本
 * 平台：Quantumult X
 * 功能：每日签到 + 浏览(5次) + 点赞(10次) + 分享(2次)
 * 定时：每天 08:05 执行
 * 作者：Hi092
 */

// ========== 安全阀：超时 170s 强制退出 ==========
var FORCE_TIMEOUT = setTimeout(function() {
  $notify("广汽本田", "⏰ 超时", "脚本执行超时，已强制结束");
  $done();
}, 170000);

// ========== 常量 ==========
var SIGN_BASE = "https://gha.ghac.cn:8805/task/app/api/sign";
var TASK_BASE = "https://gha.ghac.cn:8082/discover/app/api";
var UA = "GHA-APP-AppStore/4.1.7 (iPhone; iOS 18.7.7; Scale/3.00)";
var BROWSE_COUNT = 5;
var LIKE_COUNT = 10;
var SHARE_COUNT = 2;

// ========== 工具函数 ==========

function pad(n) { return ("0" + n).slice(-2); }

function todayStr() {
  var d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function todayDisplay() {
  var d = new Date();
  return d.getFullYear() + "年" + pad(d.getMonth() + 1) + "月" + pad(d.getDate()) + "日";
}

function getDaysInMonth() {
  var d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function getMonthStart() {
  var d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-01 00:00:00";
}

function getMonthEnd() {
  var d = new Date();
  var days = getDaysInMonth();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(days) + " 00:00:00";
}

function formatNow() {
  var d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

function delay(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

// 基础 HTTP 请求封装
function request(opts) {
  var fetchOpts = {
    url: opts.url,
    method: opts.method || "GET",
    headers: opts.headers || {},
    body: opts.body || undefined
  };

  // 如果有 body，必须设置 Content-Type（$task.fetch 不会自动设）
  if (opts.body) {
    fetchOpts.headers["Content-Type"] = "application/json; charset=UTF-8";
  }

  return new Promise(function(resolve, reject) {
    $task.fetch(fetchOpts).then(
      function(resp) {
        resolve(resp);
      },
      function(err) {
        reject(err);
      }
    );
  });
}

// 构建公共请求头
function buildHeaders(isTask) {
  var h = {
    "User-Agent": UA,
    "Accept": "*/*",
    "Accept-Language": "zh-Hans-US;q=1, en-US;q=0.9",
    "os": "ios",
    "modelType": "0",
    "version": "4.1.7",
    "systemVersion": "18.7.7",
    "X-Access-Token": token,
    "customerCode": customerCode,
    "deviceToken": deviceToken,
    "Connection": "keep-alive"
  };
  if (cookie) {
    h["Cookie"] = cookie;
  }
  if (isTask) {
    h["referrerSource"] = encodeURIComponent("发现页");
  }
  return h;
}

// 解析 JSON 响应
function parseResp(resp) {
  try {
    return JSON.parse(resp.body);
  } catch (e) {
    console.log("[GHAC] JSON 解析失败: " + resp.body.substring(0, 200));
    return null;
  }
}

// ========== 读取凭据 ==========
var token = $persistentStore.read("ghac_x_access_token") || "";
var customerCode = $persistentStore.read("ghac_customer_code") || "";
var deviceToken = $persistentStore.read("ghac_device_token") || "";
var cookie = $persistentStore.read("ghac_cookie") || "";

// 检查凭据完整性
if (!token || !customerCode) {
  clearTimeout(FORCE_TIMEOUT);
  $notify("广汽本田", "❌ 凭据缺失", "请先打开广汽本田 APP 以自动捕获凭据");
  $done();
  return;
}

// 检查防重复锁
var lastRun = $persistentStore.read("ghac_last_run_date") || "";
if (lastRun === todayStr()) {
  clearTimeout(FORCE_TIMEOUT);
  console.log("[GHAC] 今日已执行，跳过");
  $done();
  return;
}

// ========== 结果记录 ==========
var results = {
  signed: false,
  signSkipped: false,
  browse: 0,
  like: 0,
  share: 0,
  errors: []
};

// ========== 签到流程 ==========

function checkSignStatus() {
  console.log("[GHAC] 查询签到状态...");
  var body = {
    startTime: getMonthStart(),
    endTime: getMonthEnd(),
    customerCode: customerCode
  };
  return request({
    url: SIGN_BASE + "/find",
    method: "POST",
    headers: buildHeaders(false),
    body: JSON.stringify(body)
  });
}

function doSign() {
  console.log("[GHAC] 执行签到...");
  return request({
    url: SIGN_BASE + "/save",
    method: "GET",
    headers: buildHeaders(false)
  });
}

function verifySign() {
  return checkSignStatus();
}

// ========== 获取帖子列表 ==========

function getPosts() {
  console.log("[GHAC] 获取帖子列表...");
  var body = {
    pageNo: "1",
    pageSize: 20,
    ids: "",
    sort: "1",
    themeId: "",
    customerCode: customerCode,
    seriesId: "",
    isGreat: "0",
    circleType: "",
    funLabelIds: [],
    timestamp: ""
  };
  return request({
    url: TASK_BASE + "/circlecontent/page",
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(body)
  });
}

// 备用：获取资讯文章
function getNews() {
  console.log("[GHAC] 备用：获取资讯文章...");
  var body = {
    pageSize: "10",
    typeCode: "2024091101",
    pageNo: "1"
  };
  return request({
    url: TASK_BASE + "/discover-news-manage/pageByTypeNewV2",
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(body)
  });
}

// ========== 任务操作 ==========

// 浏览单个帖子
function browsePost(postId) {
  return request({
    url: TASK_BASE + "/circlecontent/share/fetch/" + postId + "?customerCode=" + customerCode,
    method: "GET",
    headers: buildHeaders(true)
  });
}

// 点赞
function likePost(postId) {
  return request({
    url: TASK_BASE + "/circlecontent/like",
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ id: postId, customerCode: customerCode })
  });
}

// 分享
function sharePost(postId) {
  return request({
    url: TASK_BASE + "/circlecontent/share?id=" + postId + "&shareTypeCode=1&typeCode=7",
    method: "GET",
    headers: buildHeaders(true)
  });
}

// ========== 主流程 ==========

// 1. 签到
function step1_sign() {
  return checkSignStatus().then(function(resp) {
    var data = parseResp(resp);
    if (!data || !data.success) {
      results.errors.push("查询签到状态失败");
      return Promise.reject("查询签到失败");
    }

    var today = todayStr();
    var signedDates = data.data || [];
    if (signedDates.indexOf(today) >= 0) {
      console.log("[GHAC] 今日已签到，跳过");
      results.signSkipped = true;
      results.signed = true;
      return Promise.resolve();
    }

    // 未签到，执行签到
    return doSign().then(function(signResp) {
      var signData = parseResp(signResp);
      if (!signData || signData.code !== 200) {
        results.errors.push("签到失败: " + (signData ? signData.code : "无响应"));
        return Promise.reject("签到失败");
      }
      console.log("[GHAC] 签到成功 ✓");

      // 验证签到结果
      return verifySign().then(function(verifyResp) {
        var verifyData = parseResp(verifyResp);
        if (verifyData && verifyData.success) {
          var dates = verifyData.data || [];
          if (dates.indexOf(today) >= 0) {
            results.signed = true;
            console.log("[GHAC] 签到验证通过 ✓");
          } else {
            results.errors.push("签到验证未通过");
          }
        }
      });
    });
  });
}

// 2-4. 任务流程
function step2_tasks() {
  return getPosts().then(function(resp) {
    var data = parseResp(resp);
    if (!data || !data.success || !data.data || !data.data.records) {
      results.errors.push("获取帖子失败");
      console.log("[GHAC] 获取帖子失败，尝试备用接口...");
      return getNews().then(function(newsResp) {
        var newsData = parseResp(newsResp);
        if (newsData && newsData.data && newsData.data.pageData && newsData.data.pageData.records) {
          return processNewsRecords(newsData.data.pageData.records);
        }
        results.errors.push("备用接口也失败");
        return Promise.resolve();
      });
    }

    var records = data.data.records;
    console.log("[GHAC] 获取到 " + records.length + " 条帖子");

    // 分离未点赞和已点赞
    var unLiked = [];
    var all = [];
    for (var i = 0; i < records.length; i++) {
      var post = records[i];
      if (post.id) {
        all.push(post);
        if (!post.isLike) {
          unLiked.push(post);
        }
      }
    }

    console.log("[GHAC] 未点赞: " + unLiked.length + ", 全部: " + all.length);

    // 选择点赞候选：优先未点赞，不够则用全部
    var likeCandidates = unLiked.length >= LIKE_COUNT ? unLiked : all;

    // 执行任务序列
    return doBrowse(all)
      .then(function() { return doLike(likeCandidates); })
      .then(function() { return doShare(all); });
  });
}

// 处理资讯备用数据
function processNewsRecords(records) {
  var all = [];
  for (var i = 0; i < records.length; i++) {
    if (records[i].id) {
      all.push({ id: records[i].id, isLike: false });
    }
  }
  if (all.length === 0) {
    results.errors.push("无可用帖子");
    return Promise.resolve();
  }
  return doBrowse(all)
    .then(function() { return doLike(all); })
    .then(function() { return doShare(all); });
}

// 浏览任务
function doBrowse(posts) {
  var count = Math.min(BROWSE_COUNT, posts.length);
  if (count === 0) {
    console.log("[GHAC] 无帖子可浏览");
    return Promise.resolve();
  }

  console.log("[GHAC] 开始浏览任务 (" + count + " 次)...");
  var chain = Promise.resolve();

  for (var i = 0; i < count; i++) {
    (function(index) {
      chain = chain.then(function() {
        var postId = posts[index].id;
        return browsePost(postId).then(function(resp) {
          var data = parseResp(resp);
          if (data && data.code === 200) {
            results.browse++;
            console.log("[GHAC] 浏览 " + (index + 1) + "/" + count + " ✓");
          } else {
            console.log("[GHAC] 浏览 " + (index + 1) + "/" + count + " ✗");
          }
        }).catch(function(err) {
          console.log("[GHAC] 浏览失败: " + err);
        }).then(function() {
          if (index < count - 1) {
            return delay(2000);
          }
        });
      });
    })(i);
  }

  return chain;
}

// 点赞任务
function doLike(posts) {
  var count = Math.min(LIKE_COUNT, posts.length);
  if (count === 0) {
    console.log("[GHAC] 无帖子可点赞");
    return Promise.resolve();
  }

  console.log("[GHAC] 开始点赞任务 (" + count + " 次)...");
  var chain = Promise.resolve();

  for (var i = 0; i < count; i++) {
    (function(index) {
      chain = chain.then(function() {
        var postId = posts[index].id;
        return likePost(postId).then(function(resp) {
          var data = parseResp(resp);
          if (data && data.code === 200) {
            results.like++;
            console.log("[GHAC] 点赞 " + (index + 1) + "/" + count + " ✓");
          } else {
            console.log("[GHAC] 点赞 " + (index + 1) + "/" + count + " ✗");
          }
        }).catch(function(err) {
          console.log("[GHAC] 点赞失败: " + err);
        }).then(function() {
          if (index < count - 1) {
            return delay(1500);
          }
        });
      });
    })(i);
  }

  return chain;
}

// 分享任务
function doShare(posts) {
  var count = Math.min(SHARE_COUNT, posts.length);
  if (count === 0) {
    console.log("[GHAC] 无帖子可分享");
    return Promise.resolve();
  }

  console.log("[GHAC] 开始分享任务 (" + count + " 次)...");
  var chain = Promise.resolve();

  for (var i = 0; i < count; i++) {
    (function(index) {
      chain = chain.then(function() {
        var postId = posts[index].id;
        return sharePost(postId).then(function(resp) {
          var data = parseResp(resp);
          if (data && data.code === 200) {
            results.share++;
            console.log("[GHAC] 分享 " + (index + 1) + "/" + count + " ✓");
          } else {
            console.log("[GHAC] 分享 " + (index + 1) + "/" + count + " ✗");
          }
        }).catch(function(err) {
          console.log("[GHAC] 分享失败: " + err);
        }).then(function() {
          if (index < count - 1) {
            return delay(1500);
          }
        });
      });
    })(i);
  }

  return chain;
}

// ========== 主入口 ==========

step1_sign()
  .then(function() {
    if (!results.signed) {
      console.log("[GHAC] 签到未成功，跳过后续任务");
      return Promise.resolve();
    }
    return step2_tasks();
  })
  .then(function() {
    // 写入防重复锁
    $persistentStore.write(todayStr(), "ghac_last_run_date");

    // 构建通知内容
    var signText = results.signSkipped ? "已签到（跳过）" : (results.signed ? "✅ 签到成功" : "❌ 签到失败");
    var taskText = "浏览 " + results.browse + "/" + BROWSE_COUNT +
      " | 点赞 " + results.like + "/" + LIKE_COUNT +
      " | 分享 " + results.share + "/" + SHARE_COUNT;
    var errorText = results.errors.length > 0 ? "\n⚠️ " + results.errors.join("; ") : "";

    var body = "📅 " + todayDisplay() + "\n" +
      "🖊️ 签到: " + signText + "\n" +
      "📋 任务: " + taskText + errorText;

    console.log("[GHAC] 执行完毕");
    console.log(body);
    $notify("广汽本田", "📊 每日签到报告", body);

    clearTimeout(FORCE_TIMEOUT);
    $done();
  })
  .catch(function(err) {
    console.log("[GHAC] 流程异常: " + err);

    var errMsg = typeof err === "string" ? err : (err.message || JSON.stringify(err));

    // 403 说明 Token 过期
    if (errMsg.indexOf("403") >= 0) {
      $notify("广汽本田", "❌ Token 已过期", "请打开广汽本田 APP 刷新凭据");
    } else {
      $notify("广汽本田", "❌ 执行异常", errMsg);
    }

    clearTimeout(FORCE_TIMEOUT);
    $done();
  });
