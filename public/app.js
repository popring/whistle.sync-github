// UI Event Handlers and Application Logic

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
  initializeEventListeners();
  loadConfiguration();
});

// Set up event listeners
function initializeEventListeners() {
  const fetchButton = document.getElementById("fetch-btn");
  const confirmButton = document.getElementById("confirm-btn");
  const saveConfigButton = document.getElementById("save-config-btn");

  if (fetchButton) {
    fetchButton.addEventListener("click", handleFetchRepository);
  }

  if (confirmButton) {
    confirmButton.addEventListener("click", handleConfirmSelection);
  }

  if (saveConfigButton) {
    saveConfigButton.addEventListener("click", handleSaveConfig);
  }
}

// Show notification
function showNotification(message, type = "success") {
  const notification = document.getElementById("notification");
  
  // Clear any existing timeout to prevent issues with multiple notifications
  if (window.notificationTimeout) {
    clearTimeout(window.notificationTimeout);
  }
  
  // Update content and show notification
  notification.textContent = message;
  notification.className = `notification ${type}`;
  
  // Automatically hide after 4 seconds
  window.notificationTimeout = setTimeout(() => {
    notification.className = "notification hide";
  }, 4000);
}

// Load configuration from server
async function loadConfiguration() {
  const loader = document.getElementById("loader");
  loader.style.display = "inline-block";

  try {
    const response = await fetch("/cgi-bin/get-config");

    if (!response.ok) {
      throw new Error("无法获取配置");
    }

    const config = await response.json();

    // 更新UI
    updateConfigurationUI(config);
  } catch (error) {
    console.error("加载配置失败:", error);
    // 显示错误状态
    document.getElementById("sync-status").textContent = "配置加载失败";
    document.getElementById("sync-status").className = "not-configured";
    showNotification("配置加载失败，请检查服务连接", "error");
  } finally {
    loader.style.display = "none";
  }
}

// Update UI with loaded configuration
function updateConfigurationUI(config) {
  const repoInput = document.getElementById("repo-url");
  const tokenInput = document.getElementById("github-token");
  const syncStatus = document.getElementById("sync-status");
  const lastSync = document.getElementById("last-updated");

  // 更新输入框值
  if (config.repo) {
    repoInput.value = config.repo;
  }

  if (config.token) {
    tokenInput.value = config.token;
  }

  // 更新状态显示
  if (config.repo) {
    syncStatus.textContent = "已配置";
    syncStatus.className = "configured";
  } else {
    syncStatus.textContent = "未配置";
    syncStatus.className = "not-configured";
  }

  // 更新最后更新时间
  if (config.lastSync) {
    const date = new Date(config.lastSync);
    lastSync.textContent = date.toLocaleString("zh-CN");
  } else {
    lastSync.textContent = "从未";
  }
}

// Handle repository fetch button click
async function handleFetchRepository() {
  const repo = document.getElementById("repo-url").value.trim();
  const token = document.getElementById("github-token").value.trim();

  if (!repo) {
    showNotification("请输入GitHub仓库地址", "error");
    return;
  }

  // 显示加载状态
  const loader = document.getElementById("loader");
  loader.style.display = "inline-block";
  document.getElementById("fetch-btn").disabled = true;

  try {
    // 发送请求到后端API获取仓库文件
    const response = await fetch(
      `/cgi-bin/get-repo-files?repoPath=${encodeURIComponent(
        repo
      )}&token=${encodeURIComponent(token)}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "获取仓库文件失败");
    }

    const files = await response.json();

    // 显示文件列表
    renderFileList(files);

    document.getElementById("file-list").style.display = "block";
    document.getElementById("confirm-btn").style.display = "block";
    showNotification("仓库文件获取成功");
  } catch (error) {
    showNotification(`获取仓库内容失败: ${error.message}`, "error");
  } finally {
    // 隐藏加载状态
    loader.style.display = "none";
    document.getElementById("fetch-btn").disabled = false;
  }
}

// Handle save configuration button click
async function handleSaveConfig() {
  const repo = document.getElementById("repo-url").value.trim();
  const token = document.getElementById("github-token").value.trim();

  if (!repo) {
    showNotification("请输入GitHub仓库地址", "error");
    return;
  }

  // 显示加载状态
  const loader = document.getElementById("loader");
  loader.style.display = "inline-block";
  document.getElementById("save-config-btn").disabled = true;

  try {
    // 发送请求到后端API保存配置
    const response = await fetch("/cgi-bin/save-config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repo,
        token,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "保存配置失败");
    }

    showNotification("配置保存成功！");

    // 重新加载配置以更新UI
    await loadConfiguration();
  } catch (error) {
    showNotification(`保存配置失败: ${error.message}`, "error");
  } finally {
    // 隐藏加载状态
    loader.style.display = "none";
    document.getElementById("save-config-btn").disabled = false;
  }
}

// Render file list with checkboxes
function renderFileList(files) {
  const filesContainer = document.getElementById("files-container");
  filesContainer.innerHTML = "";

  if (files.length === 0) {
    filesContainer.innerHTML = "<p>没有找到文件</p>";
    return;
  }

  files.forEach((file) => {
    const div = document.createElement("div");
    div.className = "file-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `file-${file}`;
    checkbox.value = file;

    const label = document.createElement("label");
    label.htmlFor = `file-${file}`;
    label.textContent = file;

    div.appendChild(checkbox);
    div.appendChild(label);
    filesContainer.appendChild(div);
  });
}

// Handle confirm button click
function handleConfirmSelection() {
  const selectedFiles = [];
  const checkboxes = document.querySelectorAll(
    '#files-container input[type="checkbox"]:checked'
  );

  checkboxes.forEach((checkbox) => {
    selectedFiles.push(checkbox.value);
  });

  if (selectedFiles.length === 0) {
    showNotification("请至少选择一个文件", "error");
    return;
  }

  showNotification(`已选择 ${selectedFiles.length} 个文件`);

  // 显示选中的文件
  if (document.getElementById("output") && document.getElementById("selected-files")) {
    document.getElementById("output").textContent = JSON.stringify(
      selectedFiles,
      null,
      2
    );
    document.getElementById("selected-files").style.display = "block";
  }
}
