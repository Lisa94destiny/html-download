document.addEventListener('DOMContentLoaded', async function() {
  console.log('Popup DOMContentLoaded - Extension loaded (v1.4)');
  const htmlCodeTextarea = document.getElementById('htmlCode');
  const clearBtn = document.getElementById('clearBtn'); // Changed from pasteBtn
  const downloadBtn = document.getElementById('downloadBtn');
  const focusHelper = document.getElementById('focusHelper');

  if (focusHelper) {
    focusHelper.focus();
    console.log('Attempted to focus helper button.');
  }

  let lastAutoDownloadedContent = null;
  // Load the last auto-downloaded content marker from storage
  chrome.storage.local.get(['lastAutoDownloadedContentMarker'], function(result) {
    if (result.lastAutoDownloadedContentMarker) {
      lastAutoDownloadedContent = result.lastAutoDownloadedContentMarker;
      console.log('Loaded last auto-downloaded marker:', lastAutoDownloadedContent.substring(0,50) + '...');
    }
  });

  // 更严格的HTML验证函数
  function isValidHtml(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    const hasDoctype = lowerText.includes('<!doctype html');
    const hasHtmlOpen = lowerText.includes('<html'); // Allow attributes in <html> tag
    const hasHtmlClose = lowerText.includes('</html>');
    // 可选：更严格的检查，例如<body>标签
    // const hasBodyOpen = lowerText.includes('<body');
    // const hasBodyClose = lowerText.includes('</body>');
    // return hasDoctype && hasHtmlOpen && hasHtmlClose && hasBodyOpen && hasBodyClose;
    console.log(`isValidHtml check: doctype=${hasDoctype}, htmlOpen=${hasHtmlOpen}, htmlClose=${hasHtmlClose}`);
    return hasDoctype && hasHtmlOpen && hasHtmlClose;
  }

  // 尝试自动从剪贴板获取内容 (无论是HTML还是普通文本，都先填充)
  console.log('Attempting to read clipboard for auto-fill and potential auto-download...');
  try {
    await new Promise(resolve => setTimeout(resolve, 75)); // Increased delay slightly
    console.log('Delay complete, now attempting clipboard read.');

    const clipboardText = await navigator.clipboard.readText();
    console.log('Clipboard text read for auto-fill:', clipboardText ? clipboardText.substring(0, 100) + '...' : '[EMPTY]');

    if (clipboardText && clipboardText.trim() !== '') {
      // 总是先自动填充文本区域
      htmlCodeTextarea.value = clipboardText;
      chrome.storage.local.set({ savedHtmlCode: clipboardText }); // Save for persistence if panel is re-opened before blur
      console.log('Textarea auto-filled with clipboard content.');

      if (isValidHtml(clipboardText)) {
        console.log('Clipboard content IS valid HTML.');
        if (clipboardText !== lastAutoDownloadedContent) {
          console.log('New valid HTML content detected. Preparing for auto-download.');
          downloadHtmlFile(clipboardText, `auto-download-${getFormattedDate()}.html`);
          lastAutoDownloadedContent = clipboardText; // Update marker
          chrome.storage.local.set({ lastAutoDownloadedContentMarker: clipboardText }); // Save marker
        } else {
          console.log('Valid HTML content is the same as last auto-download. Skipping download.');
        }
      } else {
        console.log('Clipboard content is NOT valid HTML by new check. Auto-download skipped.');
      }
    } else {
      console.log('Clipboard is empty or only whitespace. Auto-fill and auto-download skipped.');
      // 如果剪贴板为空，也尝试加载之前保存的文本（如果用户在打开面板前清空了剪贴板）
      chrome.storage.local.get(['savedHtmlCode'], function(result) {
        if (result.savedHtmlCode) {
            htmlCodeTextarea.value = result.savedHtmlCode;
            console.log('Clipboard was empty, restored previously saved code to textarea.');
        }
      });
    }
  } catch (err) {
    console.error('无法自动读取剪贴板 (Error in auto read/fill process): ', err);
    // 如果读取剪贴板失败，仍然尝试加载已保存的代码
    chrome.storage.local.get(['savedHtmlCode'], function(result) {
        if (result.savedHtmlCode) {
            htmlCodeTextarea.value = result.savedHtmlCode;
            console.log('Clipboard read failed, restored previously saved code to textarea.');
        }
    });
  }

  // 当文本区域代码改变时保存 (主要是为了在下次打开popup时能恢复，如果blur事件没触发或被阻止)
  htmlCodeTextarea.addEventListener('input', function() {
    console.log('Textarea content changed manually, saving to savedHtmlCode.');
    chrome.storage.local.set({ savedHtmlCode: htmlCodeTextarea.value });
  });

  // 清空代码按钮
  clearBtn.addEventListener('click', function() {
    console.log('Clear button clicked.');
    htmlCodeTextarea.value = '';
    chrome.storage.local.remove('savedHtmlCode');
    // Optionally, also clear the last auto-download marker if you want a re-copied item to download again immediately
    // lastAutoDownloadedContent = null;
    // chrome.storage.local.remove('lastAutoDownloadedContentMarker');
    console.log('Textarea and savedHtmlCode cleared.');
  });

  // 下载HTML代码为文件按钮
  downloadBtn.addEventListener('click', function() {
    console.log('Manual Download button clicked.');
    const codeToDownload = htmlCodeTextarea.value;
    
    if (!codeToDownload) {
      console.log('文本框中没有代码可供下载 (No code in textarea to download)');
      return;
    }
    if (isValidHtml(codeToDownload)) {
      downloadHtmlFile(codeToDownload, `manual-download-${getFormattedDate()}.html`);
    } else {
      console.log('手动下载：内容似乎不是有效的HTML，未下载。(Manual download: Content does not appear to be valid HTML. Download skipped.)');
      // alert('当前内容似乎不是有效的HTML代码，无法下载。Please ensure the content is valid HTML.'); // 可选的用户提示
    }
  });

  // 下载HTML为文件函数
  function downloadHtmlFile(htmlContent, filename) {
    console.log(`Initiating download for: ${filename}, content preview:`, htmlContent.substring(0,100) + '...');
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`Download triggered for ${filename}.`);
  }

  // 获取格式化日期的辅助函数
  function getFormattedDate() {
    const now = new Date();
    return `${now.getFullYear()}${padZero(now.getMonth() + 1)}${padZero(now.getDate())}-${padZero(now.getHours())}${padZero(now.getMinutes())}${padZero(now.getSeconds())}`;
  }

  // 为个位数补零的辅助函数
  function padZero(num) {
    return num.toString().padStart(2, '0');
  }

  // 移除之前的 blur 事件监听器，因为清空逻辑已改变
  // window.addEventListener('blur', function() { ... });
}); 