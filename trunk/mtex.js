const fs = require('fs');

const 设置 = require('./设置');

const header = [
  '\\documentclass[twocolumn]{article}',
  '\\usepackage{xeCJK}',
  '\\setCJKmainfont[AutoFakeBold]{(字体)}',
  '\\usepackage{fontspec}',
  '\\setmainfont[AutoFakeBold=4]{(字体)}',
  '\\setlength{\\parindent}{0em}',
  '\\pagestyle{empty}',
  '\\CJKsetecglue{}',
  '\\usepackage[top=(上页边距), bottom=(下页边距), left=(左页边距), right=(右页边距)]{geometry}',
  '\\usepackage{multirow}',
  '\\usepackage{array}',
  '\\setlength{\\extrarowheight}{1pt}',
  '\\begin{document}',
  '{\\bf (课程名称)} (任课教师) \\\\',
  '(考试时间) (考试地点) \\\\ \n',
].join('\n');
const footer = '\\end{document}\n';
const thead = [
  '\\begin{tabular}{ | ',
    '>{\\bfseries}m{0.5em} | ',
    '>{\\bfseries}m{1em} | ',
    'm{(词条列宽度)} | ',
    'm{(页码列宽度)} |',
  '} \\cline{1-4}\n'
].join('');
const tfoot = '\\end{tabular}\n';
const tr = function (title, char_, word, index, borderBottom) {
  return [
   title, ' & ', char_, ' & ', word, ' & ', index, '\\\\ \\cline{', borderBottom, '}\n'
  ].join('');
}
const td1_rowspan = function (rowspan, inner) {
  return ['\\multirow{', rowspan, '}{0.5em}{', inner, '}'].join('');
};
const td2_rowspan = function (rowspan, inner) {
  return ['\\multirow{', rowspan, '}{1em}{', inner, '}'].join('');
}
const br = ' \\newline ';

const TeXEscape = function (s) {
  const escapeTable = {
    '&': '\\&', '%': '\\%', '$': '\\$', '#': '\\#', '_': '\\_', '{': '\\{', '}': '\\}',
    '~': '\\textasciitilde{}', '^': '\\textasciicircum{}', '\\': '\\textbackslash{}'
  };
  return s.split('').map(function (c) {
    return (c in escapeTable) ? escapeTable[c] : c;
  }).join('');
};

const calcLines = (function () {
  const calcWidth = function (s) { return 2 * Number(s.slice(0, -2)); };
  var width3 = calcWidth(设置.词条列宽度), width4 = calcWidth(设置.页码列宽度);
  const handleSpace = function (text, width) {
    var wl = (' ' + text + ' ').replace(/\s+/g, ' ').slice(1, -1);
    var lines = 0, lb = '', wb = '', s = [], i, ls = false;
    const pushlb = function () {
      if (lb.length + wb.length + (ls ? 1 : 0) > width) {
        s[lines++] = lb; lb = wb; wb = ''; return false;
      } else {
        lb += (ls ? '\\ ' : '') + wb; wb = ''; return true;
      }
    };
    for (i = 0; i < wl.length; i++)
      if (wl[i] === ' ') {
        ls = pushlb();
      } else if (wl.charCodeAt(i) > 32 && wl.charCodeAt(i) < 127) {
        wb += wl[i];
      } else {
        pushlb(); wb = wl[i]; ls = false; pushlb();
      };
    pushlb();
    s[lines++] = lb;
    return {'text': s.join(br), 'lines': lines};
  };
  return function (line) {
    var w = handleSpace(line.word, width3), i = handleSpace(line.index, width4);
    return {
      'title': line.title,
      'char': line['char'],
      'word': w.text,
      'index': i.text,
      'lines': Math.max(w.lines, i.lines)
    };
  };
}());

const splitPage = function (lines) {
  var splited = [];
  var currentPage = [], currentPageLines = 2;
  var maxLines = 设置.每页行数;
  var i;
  for (i = 0; i < lines.length; i++) {
    if ((currentPageLines += lines[i].lines) <= maxLines)
      currentPage[currentPage.length] = lines[i];
    else {
      splited[splited.length] = currentPage;
      currentPage = [lines[i]];
      currentPageLines = lines[i].lines;
    };
  };
  splited[splited.length] = currentPage;
  return splited;
};

const makeTree = function(lines) {
  var i, currentTitle = 0, currentChar = 0;
  lines[0].tlines = lines[0].clines = 1;
  lines[0].tlinest = lines[0].clinest = lines[0].lines;
  for (i = 1; i < lines.length; i++) {
    if (lines[i]['char'] !== lines[currentChar]['char']) currentChar = i;
    if (lines[i].title !== lines[currentTitle].title) currentTitle = currentChar = i;
    lines[i - 1].bborder = '3-4';
    if (i !== currentChar) {
      lines[currentChar].clines++;
      lines[currentChar].clinest += lines[i].lines;
      lines[i]['char'] = '';
      lines[i].clines = 0; lines[i].clinest = 0;
    } else {
      lines[i].clines = 1;
      lines[i].clinest = lines[i].lines;
      lines[i - 1].bborder = '2-4';
    }
    if (i !== currentTitle) {
      lines[currentTitle].tlines++;
      lines[currentTitle].tlinest += lines[i].lines;
      lines[i].title = '';
      lines[i].tlines = 0; lines[i].tlinest = 0;
    } else {
      lines[i].tlines = 1;
      lines[i].tlinest = lines[i].lines;
      lines[i - 1].bborder = '1-4';
    }
  }
  lines[i - 1].bborder = '1-4';
  return lines;
};

const makeTeX = (function () {
  const formatConf = function (s) {
    return s.replace(/\(([^)]*)\)/g, function (s, t) { return TeXEscape(设置[t]); });
  };
  const repeat = function (s, l) {
    var t = Math.floor((l - 1) / 5) + 1, a = [];
    while (t--) a[a.length] = s;
    return a.join(Array(6).join(br));
  };
  const makeLine = function (line) {
    var t = '', c = '';
    if (line.tlines === 1) t = line.title;
    else if (line.tlines > 1) t = td1_rowspan(line.tlines, repeat(line.title, line.tlinest));
    if (line.clines === 1) c = line['char'];
    else if (line.clines > 1) c = td2_rowspan(line.clines, repeat(line['char'], line.clinest));
    return tr(t, c, line.word, line.index, line.bborder);
  };
  const makeTable = function (lines) {
    return formatConf(thead) + lines.map(makeLine).join('') + formatConf(tfoot);
  };
  return function (lines) {
    return formatConf(header) + lines.map(makeTable).join('') + formatConf(footer);
  };
}());

const mina = function () {
  var lines = JSON.parse(fs.readFileSync(设置.排序));
  lines = lines.map(calcLines);
  lines = splitPage(lines);
  lines = lines.map(makeTree);
  lines = makeTeX(lines);
  fs.writeFileSync(设置.输出, lines, 'utf8');
};

mina();

