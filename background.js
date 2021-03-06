async function formatURLAndCopyToClipboard(format, url, title, selectedText) {
  var formattedText = formatURL(format, url, title, selectedText);
  await copyTextToClipboard(formattedText);
  return browser.storage.local.set({
    lastCopied: {
      format: format,
      url: url,
      title: title,
      selectedText: selectedText,
      formattedText: formattedText
    }
  });
}

async function copyTextToClipboard(text) {
  try {
    var results = await browser.tabs.executeScript({
      code: "typeof copyToClipboard === 'function';",
    });
    // The content script's last expression will be true if the function
    // has been defined. If this is not the case, then we need to run
    // clipboard-helper.js to define function copyToClipboard.
    if (!results || results[0] !== true) {
      await browser.tabs.executeScript({
        file: "clipboard-helper.js",
      });
    }
    // clipboard-helper.js defines function copyToClipboard.
    const code = "copyToClipboard(" + JSON.stringify(text) + ");";
    return browser.tabs.executeScript({code});
  } catch (err) {
    // This could happen if the extension is not allowed to run code in
    // the page, for example if the tab is a privileged page.
    console.error("Failed to copy text: " + err);
  }
}

async function getLinkText(url) {
  response = await browser.tabs.executeScript({
    code: `
      var text = '';
      var links = document.querySelectorAll('a');
      for (var i = 0; i < links.length; i++) {
        var link = links[i];
        if (link.href === "${url}") {
          text = link.innerText.trim();
          break
        }
      }
      text;
    `
  });
  return response[0];
}

async function getSelectedText() {
  var selection = await chrome.tabs.executeScript({
    code: "window.getSelection().toString();"
  });
  var text;
  if (selection && selection[0]) {
    text = selection[0].trim().replace(/\s+/g, ' ');
  }
  return text;
}

(async function() {
  try {
    var options = await gettingOptions();
    await createContextMenus(options);
    browser.contextMenus.onClicked.addListener(async (info, tab) => {
      if (info.menuItemId.startsWith("format-link-format")) {
        try {
          var options = await gettingOptions();
          var formatID = info.menuItemId.substr("format-link-format".length);
          if (formatID === "-default") {
            formatID = options.defaultFormat;
          }
          var format = options['format' + formatID];
          var url = info.linkUrl ? info.linkUrl : info.pageUrl;
          var title = tab.title;
          var text = info.selectionText;
          if (!text) {
            if (info.linkUrl) {
              text = info.linkText ? info.linkText : await getLinkText(url);
            } else {
              text = title;
            }
          }
          await formatURLAndCopyToClipboard(format, url, title, text);
          if (formatID !== options.defaultFormat) {
            await saveDefaultFormat(formatID);
          }
        } catch (err) {
          console.error("FormatLink extension failed to copy URL to clipboard.", err);
        }
      }
    });
  } catch (err) {
    console.error("failed to create context menu", err);
  };
})();
