/*
 * 清除广汽本田签到脚本的防重复锁
 * 运行一次即可，之后可以正常执行签到脚本
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
  },
  write: function(val, key) {
    try {
      if (typeof $persistentStore !== "undefined" && $persistentStore && $persistentStore.write) {
        return $persistentStore.write(val, key);
      }
      if (typeof $prefs !== "undefined" && $prefs && $prefs.setValueForKey) {
        return $prefs.setValueForKey(val, key);
      }
    } catch (e) { return false; }
    return false;
  }
};

Store.write("", "ghac_last_run_date");
$notify("广汽本田", "🔓 防重复锁已清除", "现在可以手动运行签到脚本了");
$done({});
