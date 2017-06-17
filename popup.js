var currentTab;
var options;

function getOption(key) {
  return options[key];
}

function populateFields(url, title) {
  populateFormatGroup(url, title);
  var formatId = getOption('defaultFormat');
  populateText(formatId, url, title);
}

function getFormatCount() {
  var i;
  for (i = 1; i <= 9; ++i) {
    var optTitle = getOption('title' + i);
    var optFormat = getOption('format' + i);
    if (optTitle === '' || optFormat === '') {
      break;
    }
  }
  return i - 1;
}

function populateFormatGroup(url, title) {
  var defaultFormat = getOption('defaultFormat');
  var radios = [];
  var cnt = getFormatCount();
  var group = document.getElementById('formatGroup');
  for (var i = 1; i <= cnt; ++i) {
    var radioId = 'format' + i;

    var btn = document.createElement('input');
    btn.setAttribute('type', 'radio');
    btn.setAttribute('name', 'fomrat');
    btn.setAttribute('id', radioId);
    btn.setAttribute('value', i);
    if (i == defaultFormat) {
      btn.setAttribute('checked', 'checked');
    }
    btn.addEventListener('click', function(e) {
      var formatId = e.target.value;
      populateText(formatId, url, title);
    });

    var label = document.createElement('label');
    label.setAttribute('for', radioId);
    var optTitle = getOption('title' + i);
    var text = document.createTextNode(optTitle);
    label.appendChild(text);

    var span = document.createElement('span')
    span.setAttribute('class', 'radio');
    span.appendChild(btn);
    span.appendChild(label);

    group.appendChild(span);
  }
}

function populateText(formatId, url, title) {
  var format = getOption('format' + formatId);
  var text = formatUrl(format, url, title);
  var textElem = document.getElementById('textToCopy');
  textElem.value = text;
  textElem.focus();
  textElem.select();
  document.execCommand('copy');
}

function getSelectedFormat() {
  var cnt = getFormatCount();
  for (var i = 1; i <= cnt; ++i) {
    if (document.getElementById('format' + i).checked) {
      return i;
    }
  }
  return undefined;
}

function saveDefaultFormat() {
  browser.storage.sync.set({defaultFormat: getSelectedFormat()});
}

function init() {
  document.getElementById('saveDefaultFormatButton').addEventListener('click', saveDefaultFormat);

  onGot = function(item) {
    options = item;
    if (!options.defaultFormat) {
      options = DEFAULT_OPTIONS;
    }
  }
  onErr = function(err) {
    console.log('popup onErr', err);
  }
  function updateTab(tabs) {
    if (tabs[0]) {
      currentTab = tabs[0];
      populateFields(currentTab.url, currentTab.title);
    }
  }
  browser.storage.sync.get(optionKeys()).then(onGot, onErr).
  then(function() {
    browser.tabs.query({active: true, currentWindow: true}).then(updateTab)
  });
}

function formatUrl(format, url, title) {
  var text = '';
  var work;
  var i = 0, len = format.length;

  function parseLiteral(str) {
    if (format.substr(i, str.length) === str) {
      i += str.length;
      return str;
    } else {
      return null;
    }
  }

  function parseString() {
    var str = '';
    if (parseLiteral('"')) {
      while (i < len) {
        if (parseLiteral('\\')) {
          if (i < len) {
            str += format.substr(i++, 1);
          } else {
            throw new Error('parse error expected "');
          }
        } else if (parseLiteral('"')) {
          return str;
        } else {
          if (i < len) {
            str += format.substr(i++, 1);
          } else {
            throw new Error('parse error expected "');
          }
        }
      }
    } else {
      return null;
    }
  }

  function processVar(value) {
    var work = value;
    while (i < len) {
      if (parseLiteral('.s(')) {
        var arg1 = parseString();
        if (arg1 && parseLiteral(',')) {
          var arg2 = parseString();
          if (arg2 && parseLiteral(')')) {
            var regex = new RegExp(arg1, 'g');
            work = work.replace(regex, arg2);
          } else {
            throw new Error('parse error');
          }
        } else {
          throw new Error('parse error');
        }
      } else if (parseLiteral('}}')) {
        text += work;
        return;
      } else {
        throw new Error('parse error');
      }
    }
  }

  while (i < len) {
    if (parseLiteral('\\')) {
      if (parseLiteral('n')) {
        text += "\n";
      } else if (parseLiteral('t')) {
        text += "\t";
      } else {
        text += format.substr(i++, 1);
      }
    } else if (parseLiteral('{{')) {
      if (parseLiteral('title')) {
        processVar(title);
      } else if (parseLiteral('url')) {
        processVar(url);
      }
    } else {
      text += format.substr(i++, 1);
    }
  }
  return text;
}

document.addEventListener('DOMContentLoaded', init);
