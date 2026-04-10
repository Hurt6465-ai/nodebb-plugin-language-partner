'use strict';

(function () {
    var CONFIG = {
      maxDisplay: 50,
      activeLimit: 24 * 60 * 60 * 1000,
      listCacheTime: 10 * 60 * 1000,
      profileCacheTime: 2 * 60 * 60 * 1000,
      listKey: 'ht_list_v13_mobile',
      profKey: 'ht_prof_v13_mobile_',
      concurrency: 4,
      profileRetry: 1,
      skeletonCount: 4,
      defaultPic: 'https://ui-avatars.com/api/?background=random&color=fff&size=128',
      chatDebug: false,
      locCacheTime: 7 * 24 * 60 * 60 * 1000,
      locSyncInterval: 24 * 60 * 60 * 1000,
      locKey: 'ht_bg_loc_v5_mobile',
      locSyncKey: 'ht_bg_loc_sync_v5_mobile'
    };

    var STATE = {
      allUsers: [],
      loading: false,
      drawTimer: null,
      imageErrorBound: false
    };

    var CHAT_UI = {
      timer: null,
      logs: [],
      pendingByUid: {}
    };

    var BTN_ICON_HTML = '<i class="fa-solid fa-paper-plane"></i>';
    var BTN_LOADING_HTML = '<i class="fa fa-circle-o-notch fa-spin" style="font-size:20px;color:#ff5ca6"></i>';

    var COUNTRY_KEYWORDS = {
      cn: ['cn', 'china', '中国', '中华人民共和国', 'zh-cn'],
      tw: ['tw', 'taiwan', '台湾', 'zh-tw'],
      hk: ['hk', 'hong kong', '香港'],
      us: ['us', 'usa', 'united states', '美国'],
      gb: ['gb', 'uk', 'united kingdom', 'great britain', 'england', '英国'],
      mm: ['mm', 'myanmar', 'burma', '缅甸'],
      vn: ['vn', 'vi', 'vietnam', '越南'],
      th: ['th', 'thailand', '泰国'],
      jp: ['jp', 'japan', '日本'],
      kr: ['kr', 'korea', 'south korea', '韩国', '南韩'],
      sg: ['sg', 'singapore', '新加坡'],
      la: ['la', 'laos', '老挝'],
      my: ['my', 'malaysia', '马来西亚'],
      ph: ['ph', 'philippines', '菲律宾'],
      id: ['id', 'indonesia', '印尼', '印度尼西亚'],
      kh: ['kh', 'cambodia', '柬埔寨'],
      in: ['in', 'india', '印度'],
      fr: ['fr', 'france', '法国'],
      de: ['de', 'germany', '德国'],
      br: ['br', 'brazil', '巴西'],
      ca: ['ca', 'canada', '加拿大'],
      au: ['au', 'australia', '澳大利亚'],
      ru: ['ru', 'russia', '俄罗斯']
    };

    function getConfig() {
      if (window.config) return window.config;
      if (typeof config !== 'undefined') return config;
      return {};
    }

    function bp() {
      return getConfig().relative_path || '';
    }

    function csrf() {
      return getConfig().csrf_token || '';
    }

    function hasUserEnv() {
      return !!(window.app && window.app.user);
    }

    function logChat(level, msg, data) {
      if (!CONFIG.chatDebug) return;
      CHAT_UI.logs.push({ t: Date.now(), level: level, msg: msg, data: data || null });
      if (CHAT_UI.logs.length > 100) CHAT_UI.logs.shift();

      if (level === 'error') console.error('[ht-partner]', msg, data || '');
      else if (level === 'warn') console.warn('[ht-partner]', msg, data || '');
      else console.log('[ht-partner]', msg, data || '');
    }

    function esc(s) {
      var div = esc._div || (esc._div = document.createElement('div'));
      div.textContent = String(s == null ? '' : s);
      return div.innerHTML;
    }

    function cleanText(v) {
      return String(v == null ? '' : v).replace(/["\[\]{}]/g, '').trim();
    }

    function stripHtml(v) {
      return String(v == null ? '' : v).replace(/<[^>]+>/g, '').trim();
    }

    function normalizeGender(g) {
      var s = String(g == null ? '' : g).toLowerCase().trim();
      if (!s) return '';
      if (s === '男' || s === 'm' || s === 'male' || s.indexOf('男') !== -1) return 'M';
      if (s === '女' || s === 'f' || s === 'female' || s.indexOf('女') !== -1) return 'F';
      return '';
    }

    function genderBadgeHtml(gc) {
      if (gc === 'M') return '<span class="ht-gender gender-male" title="男"><i class="fa-solid fa-mars"></i></span>';
      if (gc === 'F') return '<span class="ht-gender gender-female" title="女"><i class="fa-solid fa-venus"></i></span>';
      return '';
    }

    function parseLang(val) {
      if (!val) return '';
      try {
        var parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed.join(' ') : String(val);
      } catch (e) {
        return String(val).replace(/["\[\]{}]/g, '');
      }
    }

    function toCode(str) {
      if (!str) return '未知';

      var s = String(str).toLowerCase().trim().replace(/["\[\]{}]/g, '');
      if (/^[a-z]{2}$/.test(s)) return s.toUpperCase();

      var map = {
        cn: 'CN', zh: 'CN', china: 'CN', chinese: 'CN', 中文: 'CN', 汉语: 'CN',
        en: 'EN', us: 'EN', uk: 'EN', english: 'EN', 英语: 'EN',
        vi: 'VI', vn: 'VI', vietnam: 'VI', vietnamese: 'VI', 越南: 'VI', 越南语: 'VI',
        mm: 'MM', myanmar: 'MM', burmese: 'MM', 缅甸: 'MM', 缅甸语: 'MM',
        th: 'TH', thai: 'TH', thailand: 'TH', 泰语: 'TH',
        jp: 'JP', japan: 'JP', japanese: 'JP', 日语: 'JP',
        kr: 'KR', korea: 'KR', korean: 'KR', 韩语: 'KR'
      };

      for (var k in map) {
        if (Object.prototype.hasOwnProperty.call(map, k) && s.indexOf(k) !== -1) return map[k];
      }

      return s.length >= 2 ? s.substring(0, 2).toUpperCase() : '未知';
    }

    function timeStr(ms) {
      var ts = Number(ms || 0);
      if (!ts) return '最近在线';

      var diff = Date.now() - ts;
      if (diff < 0) diff = 0;

      var m = Math.floor(diff / 60000);
      if (m < 1) return '刚刚';
      if (m < 60) return m + '分钟前';

      var h = Math.floor(m / 60);
      if (h < 24) return h + '小时前';

      var d = Math.floor(h / 24);
      if (d < 7) return d + '天前';

      return '7天前';
    }

    function matchCountryCode(value) {
      var txt = cleanText(value).toLowerCase();
      if (!txt) return '';

      if (/^[a-z]{2}$/.test(txt) && COUNTRY_KEYWORDS[txt]) {
        return txt;
      }

      for (var code in COUNTRY_KEYWORDS) {
        if (!Object.prototype.hasOwnProperty.call(COUNTRY_KEYWORDS, code)) continue;
        var arr = COUNTRY_KEYWORDS[code];
        for (var i = 0; i < arr.length; i++) {
          if (txt === arr[i] || txt.indexOf(arr[i]) !== -1) {
            return code;
          }
        }
      }

      return '';
    }

    function resolveFlagCode(u) {
      var candidates = [
        u.countryCode,
        u.country_code,
        u.country,
        u.country_name,
        u.nationality,
        u.region,
        u.location,
        u.language_flag
      ];

      for (var i = 0; i < candidates.length; i++) {
        var code = matchCountryCode(candidates[i]);
        if (code) return code;
      }

      return '';
    }

    var Store = {
      get: function (k) {
        try {
          var v = localStorage.getItem(k);
          if (!v) return null;

          var p = JSON.parse(v);
          if (!p || typeof p.e !== 'number' || typeof p.d === 'undefined') return null;

          if (Date.now() > p.e) {
            localStorage.removeItem(k);
            return null;
          }

          return p.d;
        } catch (e) {
          try { localStorage.removeItem(k); } catch (x) {}
          return null;
        }
      },

      set: function (k, d, ttl) {
        try {
          localStorage.setItem(k, JSON.stringify({ d: d, e: Date.now() + ttl }));
        } catch (e) {
          this.evictProfiles();
          try {
            localStorage.setItem(k, JSON.stringify({ d: d, e: Date.now() + ttl }));
          } catch (x) {}
        }
      },

      remove: function (k) {
        try { localStorage.removeItem(k); } catch (e) {}
      },

      evictProfiles: function () {
        try {
          var keys = [];
          for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.indexOf(CONFIG.profKey) === 0) keys.push(key);
          }
          keys.sort();
          var half = Math.ceil(keys.length / 2);
          for (var j = 0; j < half; j++) {
            localStorage.removeItem(keys[j]);
          }
        } catch (e) {}
      }
    };

    function canUseChatFor(uid) {
      if (!hasUserEnv()) return false;
      var me = window.app.user;
      if (!me || !me.uid) return false;
      if (getConfig().disableChat) return false;
      if (me.privileges && me.privileges.chat === false) return false;
      return Number(me.uid) !== Number(uid || 0);
    }

    function mergeUser(base, detail) {
      return $.extend({}, detail || {}, base || {});
    }

    function decorateUser(raw) {
      var u = $.extend({}, raw);

      var pic = u.picture;
      if (!pic) {
        pic = CONFIG.defaultPic + '&name=' + encodeURIComponent(u.username || 'U');
      } else if (pic.indexOf('http') !== 0 && pic.indexOf('//') !== 0) {
        pic = bp() + pic;
      }

      var nativeCode = toCode(parseLang(u.language_fluent || u.native_language));
      var learnCode = toCode(parseLang(u.language_learning || u.target_language));
      var genderCode = normalizeGender(u.gender || u.sex);

      var bio = stripHtml(u.aboutme || u.signature || '');
      if (!bio) bio = '暂无介绍';
      if (bio.length > 60) bio = bio.substring(0, 60) + '…';

      var lastOnline = Number(u.lastonline || 0);
      var isOnline = (u.status === 'online') || (lastOnline && (Date.now() - lastOnline < 10 * 60 * 1000));

      var flagCode = resolveFlagCode(u);

      u._picture = pic;
      u._nativeCode = nativeCode;
      u._learnCode = learnCode;
      u._genderCode = genderCode;
      u._genderHtml = genderBadgeHtml(genderCode);
      u._bio = bio;
      u._isOnline = isOnline;
      u._statusText = isOnline ? '当前在线' : timeStr(lastOnline);
      u._statusTextCls = isOnline ? 'text-online' : '';
      u._statusDotCls = isOnline ? 'online' : '';
      u._flagCode = flagCode;
      u._flagSrc = flagCode ? ('https://flagcdn.com/w40/' + flagCode + '.png') : '';
      u._profileLink = bp() + '/user/' + encodeURIComponent(u.userslug || '') + '/topics';
      u._canChat = canUseChatFor(u.uid);

      return u;
    }

    function buildCardHTML(u) {
      var flagHtml = '';
      if (u._flagSrc) {
        flagHtml = '<img class="ht-flag-icon" src="' + esc(u._flagSrc) + '" loading="lazy" alt="flag">';
      }

      var h = '';
      h += '<div class="ht-card" data-uid="' + Number(u.uid || 0) + '">';
      h +=   '<a href="' + esc(u._profileLink) + '" class="ht-card-main">';
      h +=     '<div class="ht-left">';
      h +=       '<div class="ht-avatar-wrap">';
      h +=         '<img class="ht-avatar" src="' + esc(u._picture) + '" loading="lazy" alt="' + esc(u.username || '') + '">';
      h +=         flagHtml;
      h +=       '</div>';
      h +=       '<div class="ht-status-row ' + esc(u._statusTextCls) + '">';
      h +=         '<div class="status-dot ' + esc(u._statusDotCls) + '"></div>';
      h +=         esc(u._statusText);
      h +=       '</div>';
      h +=     '</div>';
      h +=     '<div class="ht-body">';
      h +=       '<div class="ht-main">';
      h +=         '<div class="ht-row-1">';
      h +=           '<span class="ht-name-wrap">';
      h +=             '<span class="ht-name">' + esc(u.username || '匿名用户') + '</span>';
      h +=             u._genderHtml;
      h +=           '</span>';
      h +=         '</div>';
      h +=         '<div class="ht-langs">';
      h +=           '<span class="lang-native">' + esc(u._nativeCode) + '</span>';
      h +=           '<span class="lang-swap">⇄</span>';
      h +=           '<span class="lang-learn">' + esc(u._learnCode) + '</span>';
      h +=         '</div>';
      h +=         '<div class="ht-bio">' + esc(u._bio) + '</div>';
      h +=       '</div>';
      h +=     '</div>';
      h +=   '</a>';

      if (u._canChat) {
        h += '<div class="ht-side-col">';
        h +=   '<button type="button" class="ht-greet-btn" data-uid="' + Number(u.uid || 0) + '" aria-label="打招呼" title="打招呼">';
        h +=     BTN_ICON_HTML;
        h +=   '</button>';
        h += '</div>';
      }

      h += '</div>';
      return h;
    }

    function renderSkeleton(count) {
      count = count || CONFIG.skeletonCount;
      var html = '';

      for (var i = 0; i < count; i++) {
        html += ''
          + '<div class="ht-skeleton-card">'
          +   '<div class="ht-skeleton-left">'
          +     '<div class="ht-skeleton-avatar"></div>'
          +     '<div class="ht-skeleton-status"></div>'
          +   '</div>'
          +   '<div class="ht-skeleton-main">'
          +     '<div class="ht-skeleton-line lg"></div>'
          +     '<div class="ht-skeleton-line md"></div>'
          +     '<div class="ht-skeleton-line sm"></div>'
          +   '</div>'
          +   '<div class="ht-skeleton-side">'
          +     '<div class="ht-skeleton-btn"></div>'
          +   '</div>'
          + '</div>';
      }

      $('#ht-user-list').html(html);
    }

    function scheduleDraw() {
      clearTimeout(STATE.drawTimer);
      STATE.drawTimer = setTimeout(filterAndDraw, 16);
    }

    function filterAndDraw() {
      var lang = $('#lang-filter').val();
      var gender = $('#gender-filter').val();
      var filtered = [];

      for (var i = 0; i < STATE.allUsers.length; i++) {
        var u = STATE.allUsers[i];
        if (lang && u._nativeCode !== lang) continue;
        if (gender && u._genderCode !== gender) continue;
        filtered.push(u);
      }

      if (!filtered.length) {
        $('#ht-user-list').html('<div class="footer-msg">没有找到符合条件的用户</div>');
      } else {
        var html = [];
        for (var j = 0; j < filtered.length; j++) {
          html.push(buildCardHTML(filtered[j]));
        }
        $('#ht-user-list').html(html.join(''));
      }

      $('#header-stats').text(filtered.length + '人');
    }

    function loadData() {
      if (STATE.loading) return;

      var cached = Store.get(CONFIG.listKey);
      if (cached && cached.length) {
        processList(cached, false);
        fetchLatestList();
      } else {
        renderSkeleton();
        $('#header-stats').text('加载中...');
        fetchLatestList();
      }
    }

    function fetchLatestList() {
      if (STATE.loading) return;
      STATE.loading = true;

      $.ajax({
        url: bp() + '/api/users',
        data: { section: 'online', itemsPerPage: 100 },
        dataType: 'json',
        timeout: 15000,
        success: function (data) {
          STATE.loading = false;

          var users = (data && data.users) || [];
          var active = [];
          var now = Date.now();

          for (var i = 0; i < users.length; i++) {
            var lastOnline = Number(users[i].lastonline || 0);
            if (lastOnline && (now - lastOnline < CONFIG.activeLimit)) {
              active.push(users[i]);
            }
          }

          active.sort(function (a, b) {
            return Number(b.lastonline || 0) - Number(a.lastonline || 0);
          });

          if (active.length > CONFIG.maxDisplay) {
            active = active.slice(0, CONFIG.maxDisplay);
          }

          Store.set(CONFIG.listKey, active, CONFIG.listCacheTime);
          processList(active, true);
        },
        error: function () {
          STATE.loading = false;

          if (!STATE.allUsers.length) {
            $('#ht-user-list').html('<div class="footer-msg">加载失败，请稍后刷新重试</div>');
            $('#header-stats').text('加载失败');
          } else {
            showFooterMsg('列表更新失败，已展示缓存内容', true);
          }
        }
      });
    }

    function processList(list, fetchMissing) {
      var full = [];
      var queue = [];

      for (var i = 0; i < list.length; i++) {
        var base = list[i];
        var detail = Store.get(CONFIG.profKey + base.uid);
        var merged = mergeUser(base, detail);
        full.push(decorateUser(merged));

        if (fetchMissing && base.userslug) {
          queue.push(base);
        }
      }

      STATE.allUsers = full;
      filterAndDraw();

      if (fetchMissing && queue.length) {
        fetchProfiles(queue);
      }
    }

    function updateUserInState(uid, data) {
      for (var i = 0; i < STATE.allUsers.length; i++) {
        if (Number(STATE.allUsers[i].uid) === Number(uid)) {
          var merged = mergeUser(STATE.allUsers[i], data);
          STATE.allUsers[i] = decorateUser(merged);
          return;
        }
      }
    }

    function fetchProfiles(queue) {
      var index = 0;
      var active = 0;
      var done = 0;
      var total = queue.length;

      function next() {
        while (active < CONFIG.concurrency && index < total) {
          runOne(queue[index++], 0);
        }
      }

      function runOne(user, retry) {
        active++;

        fetchOneProfile(user)
          .done(function (profile) {
            if (profile) {
              Store.set(CONFIG.profKey + user.uid, profile, CONFIG.profileCacheTime);
              updateUserInState(user.uid, profile);
              scheduleDraw();
            } else if (retry < CONFIG.profileRetry) {
              active--;
              runOne(user, retry + 1);
            }
          })
          .fail(function () {
            if (retry < CONFIG.profileRetry) {
              active--;
              runOne(user, retry + 1);
            }
          })
          .always(function () {
            done++;
            active--;

            if (done >= total) {
              scheduleDraw();
            } else {
              next();
            }
          });
      }

      next();
    }

    function fetchOneProfile(user) {
      var dfd = $.Deferred();

      if (!user || !user.userslug) {
        dfd.resolve(null);
        return dfd.promise();
      }

      $.ajax({
        url: bp() + '/api/user/' + encodeURIComponent(user.userslug),
        dataType: 'json',
        timeout: 10000
      }).done(function (data) {
        var profile = (data && data.user) || data;
        if (profile && profile.uid) dfd.resolve(profile);
        else dfd.resolve(null);
      }).fail(function () {
        dfd.reject();
      });

      return dfd.promise();
    }

    function showFooterMsg(msg, isError) {
      var $f = $('#ht-footer-msg');
      if (!$f.length) return;

      $f.stop(true, true)
        .text(msg)
        .css('color', isError ? '#e64a19' : '#999')
        .show();

      clearTimeout(CHAT_UI.timer);
      CHAT_UI.timer = setTimeout(function () {
        $f.fadeOut(180);
      }, 2200);
    }

    function extractRoomId(payload) {
      if (payload == null) return 0;
      if (typeof payload === 'number' && payload > 0) return payload;
      if (typeof payload === 'string' && /^\d+$/.test(payload)) return Number(payload);
      if (typeof payload !== 'object') return 0;

      var keys = ['roomId', 'roomid', 'rid', 'id'];
      for (var i = 0; i < keys.length; i++) {
        var v = payload[keys[i]];
        if (typeof v === 'number' && v > 0) return v;
        if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
      }

      var nested = ['response', 'data', 'payload'];
      for (var j = 0; j < nested.length; j++) {
        var obj = payload[nested[j]];
        if (obj && typeof obj === 'object') {
          for (var k = 0; k < keys.length; k++) {
            var w = obj[keys[k]];
            if (typeof w === 'number' && w > 0) return w;
            if (typeof w === 'string' && /^\d+$/.test(w)) return Number(w);
          }
        }
      }

      return 0;
    }

    function goToChatRoom(roomId) {
      var rid = Number(roomId || 0);
      if (!rid) return;

      var slug = '';
      if (hasUserEnv() && window.app.user.userslug) {
        slug = window.app.user.userslug;
      }

      var path = slug ? ('user/' + slug + '/chats/' + rid) : ('chats/' + rid);

      if (window.ajaxify && typeof window.ajaxify.go === 'function') {
        window.ajaxify.go(path);
      } else {
        window.location.href = bp() + '/' + path;
      }
    }

    function emitSocket(eventName, payload) {
      var dfd = $.Deferred();

      if (!window.socket || typeof window.socket.emit !== 'function') {
        dfd.reject(new Error('与服务器连接断开'));
        return dfd.promise();
      }

      var done = false;
      var timer = setTimeout(function () {
        if (!done) {
          done = true;
          dfd.reject(new Error('socket 超时: ' + eventName));
        }
      }, 10000);

      try {
        window.socket.emit(eventName, payload, function (err, data) {
          if (done) return;
          done = true;
          clearTimeout(timer);

          if (err) {
            var msg = typeof err === 'string' ? err : (err.message || 'socket error');
            dfd.reject(new Error(msg));
          } else {
            dfd.resolve(data);
          }
        });
      } catch (e) {
        clearTimeout(timer);
        dfd.reject(e);
      }

      return dfd.promise();
    }

    function postCreateChat(url, uid) {
      return fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrf()
        },
        body: JSON.stringify({ uids: [uid] })
      }).then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      }).then(function (data) {
        var rid = extractRoomId(data);
        if (!rid) throw new Error('未返回 roomId');
        return rid;
      });
    }

    function findPrivateRoom(uid) {
      var payloads = [uid, { uid: uid }, { uids: [uid] }];
      var dfd = $.Deferred();
      var idx = 0;

      function tryNext() {
        if (idx >= payloads.length) {
          dfd.resolve(0);
          return;
        }

        emitSocket('modules.chats.hasPrivateChat', payloads[idx++])
          .done(function (data) {
            var rid = extractRoomId(data);
            if (rid) dfd.resolve(rid);
            else tryNext();
          })
          .fail(function () {
            tryNext();
          });
      }

      tryNext();
      return dfd.promise();
    }

    function createPrivateRoom(uid) {
      var socketEvents = [
        { event: 'modules.chats.newRoom', payload: { uids: [uid] } },
        { event: 'modules.chats.create', payload: { uids: [uid] } },
        { event: 'modules.chats.new', payload: { uids: [uid] } }
      ];

      var dfd = $.Deferred();
      var idx = 0;

      function trySocket(lastErr) {
        if (idx >= socketEvents.length) {
          tryHttp(lastErr);
          return;
        }

        var cur = socketEvents[idx++];
        emitSocket(cur.event, cur.payload)
          .done(function (data) {
            var rid = extractRoomId(data);
            if (!rid) {
              trySocket(new Error(cur.event + ' 未返回 roomId'));
              return;
            }
            dfd.resolve(rid);
          })
          .fail(function (err) {
            logChat('warn', 'socket create fail', err);
            trySocket(err);
          });
      }

      function tryHttp(lastErr) {
        var urls = [bp() + '/api/v3/chats', bp() + '/api/chats'];
        var i = 0;

        function nextHttp(errObj) {
          if (i >= urls.length) {
            dfd.reject(errObj || lastErr || new Error('创建聊天室失败'));
            return;
          }

          var url = urls[i++];
          postCreateChat(url, uid)
            .then(function (rid) {
              dfd.resolve(rid);
            })
            .catch(function (err) {
              logChat('warn', 'http create fail', err);
              nextHttp(err);
            });
        }

        nextHttp(lastErr);
      }

      trySocket();
      return dfd.promise();
    }

    function openChatWithUid(uid) {
      uid = Number(uid || 0);
      if (!uid) return $.Deferred().reject(new Error('UID 无效')).promise();

      if (!hasUserEnv()) return $.Deferred().reject(new Error('请先登录')).promise();

      var me = window.app.user;
      if (!me || !me.uid) return $.Deferred().reject(new Error('请先登录')).promise();
      if (getConfig().disableChat) {
        return $.Deferred().reject(new Error('站点已关闭聊天')).promise();
      }
      if (Number(me.uid) === uid) {
        return $.Deferred().reject(new Error('不能和自己聊天')).promise();
      }

      if (CHAT_UI.pendingByUid[uid]) return CHAT_UI.pendingByUid[uid];

      var dfd = $.Deferred();

      findPrivateRoom(uid)
        .then(function (roomId) {
          if (roomId) return roomId;
          return createPrivateRoom(uid);
        })
        .then(function (roomId) {
          goToChatRoom(roomId);
          dfd.resolve(roomId);
        })
        .catch(function (err) {
          dfd.reject(err);
        })
        .always(function () {
          delete CHAT_UI.pendingByUid[uid];
        });

      CHAT_UI.pendingByUid[uid] = dfd.promise();
      return CHAT_UI.pendingByUid[uid];
    }

    function handleGreet(btnEl) {
      if (!btnEl || btnEl.dataset.busy === '1') return;

      var uid = Number(btnEl.getAttribute('data-uid') || 0);
      if (!uid) return;

      btnEl.dataset.busy = '1';
      btnEl.classList.add('is-loading');
      btnEl.innerHTML = BTN_LOADING_HTML;

      openChatWithUid(uid)
        .catch(function (err) {
          logChat('error', 'openChat failed', err);
          showFooterMsg((err && err.message) || '打开聊天室失败', true);
        })
        .always(function () {
          if (!document.contains(btnEl)) return;
          btnEl.dataset.busy = '0';
          btnEl.classList.remove('is-loading');
          btnEl.innerHTML = BTN_ICON_HTML;
        });
    }

    function bindImageErrorFallback() {
      if (STATE.imageErrorBound) return;
      STATE.imageErrorBound = true;

      var listEl = document.getElementById('ht-user-list');
      if (!listEl) return;

      listEl.addEventListener('error', function (e) {
        var target = e.target;
        if (!target || !target.className) return;

        if (target.classList && target.classList.contains('ht-flag-icon')) {
          target.style.display = 'none';
        }

        if (target.classList && target.classList.contains('ht-avatar')) {
          var alt = target.getAttribute('alt') || 'U';
          target.src = CONFIG.defaultPic + '&name=' + encodeURIComponent((alt || 'U').charAt(0));
        }
      }, true);
    }

    function bindEvents() {
      var $list = $('#ht-user-list');

      $list.off('.htpartnerList');
      $('#lang-filter').off('.htpartnerLang');
      $('#gender-filter').off('.htpartnerGender');

      $list.on('click.htpartnerList', '.ht-greet-btn', function (e) {
        e.preventDefault();
        e.stopPropagation();
        handleGreet(this);
        return false;
      });

      $list.on('keydown.htpartnerList', '.ht-greet-btn', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          handleGreet(this);
        }
      });

      $('#lang-filter').on('change.htpartnerLang', filterAndDraw);
      $('#gender-filter').on('change.htpartnerGender', filterAndDraw);

      bindImageErrorFallback();
    }

    function startBackgroundLocationSync() {
      if (!hasUserEnv()) return;
      if (!navigator.geolocation) return;

      var lastSync = Store.get(CONFIG.locSyncKey);
      if (typeof lastSync === 'number' && (Date.now() - lastSync < CONFIG.locSyncInterval)) {
        return;
      }

      var cachedLoc = Store.get(CONFIG.locKey);
      if (cachedLoc && isFinite(cachedLoc.lat) && isFinite(cachedLoc.lng)) {
        uploadLocation(cachedLoc);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          Store.set(CONFIG.locKey, loc, CONFIG.locCacheTime);
          uploadLocation(loc);
        },
        function () {},
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 30 * 60 * 1000
        }
      );
    }

    function uploadLocation(loc) {
      if (!hasUserEnv()) return;
      if (!window.app.user || !window.app.user.uid) return;

      $.ajax({
        url: bp() + '/api/v3/users/' + window.app.user.uid,
        type: 'PUT',
        headers: { 'x-csrf-token': csrf() },
        contentType: 'application/json',
        data: JSON.stringify({
          location: Number(loc.lat).toFixed(4) + ',' + Number(loc.lng).toFixed(4)
        }),
        timeout: 8000
      }).always(function () {
        Store.set(CONFIG.locSyncKey, Date.now(), CONFIG.locCacheTime);
      });
    }

    function exposeDebug() {
      window.HTPartnerDebug = {
        reloadList: function () {
          Store.remove(CONFIG.listKey);
          loadData();
        },
        state: STATE,
        config: CONFIG
      };
    }

    function initPage() {
      if (!$('#ht-user-list').length) return;
      bindEvents();
      exposeDebug();
      loadData();

      // Disable this call if you do not want the plugin to request and upload browser geolocation.
      setTimeout(startBackgroundLocationSync, 1200);
    }

    function boot() {
    if (!window.jQuery) return;
    if (!$('#ht-user-list').length) return;
    initPage();
  }

  if (window.jQuery) {
    $(document).ready(boot);

    $(window)
      .off('action:ajaxify.end.htpartner')
      .on('action:ajaxify.end.htpartner', function () {
        if ($('#ht-user-list').length) {
          boot();
        }
      });
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }
})();
