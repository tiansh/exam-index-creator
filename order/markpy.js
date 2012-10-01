const fs = require('fs');
const util = require('util');

const 设置 = require('./设置');
const pinyin = require('./pinyin');
const pinyinz = require('./pinyinz');

const $call = function (f, args) { setTimeout(function () { f.apply(null, args); }, 0); };
const $print = function () { process.stdout.write(util.format.apply(null, arguments)); };
const $input = (function () {
  var listener = [];
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', function (chunk) {
    var line = chunk.replace(/\r|\n/g, '');
    if (listener.length) {
      $call(listener[0], [line]);
      lines = '';
      listener = listener.slice(1);
    }
  });
  process.stdin.on('end', function () { process.exit(0); });
  return function (callback) { listener[listener.length] = callback; };
}());

const reads = (function (filename) {
  var 设置_reads = {};
  try { 设置_reads = JSON.parse(fs.readFileSync(filename, 'utf8')); } catch (e) {};
  var writeConf = function () {
    var text = JSON.stringify(设置_reads).replace(/,/g, ',\n').replace('{', '{\n').replace('}', '\n}');
    fs.writeFileSync(filename, text, 'utf8');
  };
  var readsOfWord = function (w, callback) {
    var currentChar = 0, defaultRead = true, a = [];
    (function () {
      var readsOfNextChar = function () {
        var nextChar = arguments.callee;
        var ret = function (r) {
          a[a.length] = r;
          if (currentChar === w.length) (function () {
            var aj = a.join('');
            if (!defaultRead) { 设置_reads[w] = aj; writeConf(); };
            $call(callback, [aj]);
          }()); else $call(nextChar);
        };
        var i = currentChar++;
        if (w.slice(i, i + 2) === '$<') (function () {
          currentChar += 2;
          var start = i + 2, end = currentChar++;
          while (w.slice(end, end + 2) !== '>$') {
            if (currentChar < w.length) end = (currentChar++ - 1);
            else { end = w.length; break; }
          };
          ret(w.slice(start, end));
        }());
        if (('.' + w[i]) in 设置_reads) return ret(设置_reads['.' + w[i]]);
        if (w[i] === ' ' || w[i] === '　') return ret('  ');
        if (w[i].charCodeAt(0) <= 127) return ret(w[i].toUpperCase());
        var r = pinyin[w[i]] || []; if (r.length === 1) return ret(r[0] + w[i]);
        $print("%s%s\n",
          util.format('%s[%s]%s', w.slice(0, i), w[i], w.slice(i + 1)),
          (r.length > 0 ?  ('\n' + r.map(function (s, i) { 
            return util.format('%d: %s  ', i + 1, s);
          }).join('')) : '')
        );
        (function () {
          var ask = arguments.callee;
          $print('> ');
          $input(function (userread) {
            var n, add2Default = false;
            var rret = function (r) {
              if (add2Default) { 设置_reads['.' + w[i]] = r; writeConf(); }
              else defaultRead = false;
              ret(r);
            };
            if (userread[0] === '0') { add2Default = true; userread = userread.slice(1); }
            if (userread === '') userread = '1';
            if (n = Number(userread)) { if (n > 0 && n <= r.length) return rret(r[n - 1] + w[i]); }
            if (userread[0] === '\'') return rret(userread.slice(1).replace('$$', w[i]));
            userread = userread.toLowerCase().replace(/v(.*)$/, 'u$1:');
            if (pinyinz.indexOf(userread) !== -1) return rret(userread + w[i]);
            ask();
          });
        }());
      };
      readsOfNextChar();
    }());
  };
  var lookupWord = function (w, callback) {
    if (!w) $call(callback);
    else if (w in 设置_reads) $call(callback, [设置_reads[w]]);
    else readsOfWord(w, function (a) { $call(callback, [a]); });
  };
  return function (wl, callback) {
    var currentWord = 0, a = {};
    (function () {
      var i = currentWord++, nextWord = arguments.callee;
      if (i === wl.length) return $call(callback, [a]);
      if (!wl[i]) return $call(nextWord);
      lookupWord(wl[i], function (r) { a[r] = wl[i]; $call(nextWord); });
    }());
  };
}(设置.读音));


const mina = function () {
  var words = fs.readFileSync(设置.词条, 'utf8');
  var wordlist = {};
  words = words.replace(/\r/g, '\n').replace(/\n\n\n*/g, '\n').split('\n')
   .map(function (l) {
     var s = l.split('\t');
     s[0] = s[0].replace(/\$</g, '').replace(/>\$/g, '');
     if (s[0] in wordlist) { wordlist[s[0]] += 设置.分隔符 + s[1]; return ''; }
     else { wordlist[s[0]] = s[1]; return s[0]; };
  });
  reads(words, function (words) {
    var w, list = [];
    for (w in words) list[list.length] = w; list.sort();
    var result = list.map(function (w) {
      return {
        'title': (w[0] >= 'a' && w[0] <= 'z') ? w[0].toUpperCase() : '-',
        'char': words[w][0],
        'word': words[w],
        'index': wordlist[words[w]]
      };
    });
    var output = JSON.stringify(result)
      .replace(/},/g, '},\n').replace('[', '[\n').replace(']', '\n]');
    fs.writeFileSync(设置.输出, output, 'utf8');
    process.stdin.pause();
  });
};

mina();
