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
  const syncTypeSelect = document.getElementById("sync-type");
  const syncFromRemoteBtn = document.getElementById("sync-from-remote");
  const syncToRemoteBtn = document.getElementById("sync-to-remote");
  const githubSyncBtn = document.getElementById("github-sync-btn");

  if (fetchButton) {
    fetchButton.addEventListener("click", handleFetchRepository);
  }

  if (confirmButton) {
    confirmButton.addEventListener("click", handleConfirmSelection);
  }

  if (saveConfigButton) {
    saveConfigButton.addEventListener("click", handleSaveConfig);
  }

  if (syncTypeSelect) {
    syncTypeSelect.addEventListener("change", toggleSyncTypeUI);
    // 初始化触发一次以设置正确的显示状态
    toggleSyncTypeUI();
  }

  if (syncFromRemoteBtn) {
    syncFromRemoteBtn.addEventListener("click", handleSyncFromRemote);
  }

  if (syncToRemoteBtn) {
    syncToRemoteBtn.addEventListener("click", handleSyncToRemote);
  }
  
  if (githubSyncBtn) {
    githubSyncBtn.addEventListener("click", handleGithubSync);
  }
}

// Toggle UI based on sync type selection
function toggleSyncTypeUI() {
  const syncType = document.getElementById("sync-type").value;
  const githubConfig = document.getElementById("github-config");
  const gitConfig = document.getElementById("git-config");
  const gitSyncBtns = document.getElementById("git-sync-buttons");

  if (syncType === "github") {
    githubConfig.style.display = "block";
    gitConfig.style.display = "none";
    if (gitSyncBtns) gitSyncBtns.style.display = "none";
  } else {
    githubConfig.style.display = "none";
    gitConfig.style.display = "block";
    if (gitSyncBtns) gitSyncBtns.style.display = "flex";
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
  const syncTypeSelect = document.getElementById("sync-type");

  // 设置同步类型
  if (config.syncType) {
    syncTypeSelect.value = config.syncType;
    toggleSyncTypeUI(); // 更新UI显示
  }

  // 更新输入框值
  if (config.repo) {
    repoInput.value = config.repo;
  }

  if (config.token) {
    tokenInput.value = config.token;
  }

  // 更新Git配置(如果存在)
  if (config.git) {
    document.getElementById("git-repo-url").value = config.git.repoUrl || "";
    document.getElementById("git-branch").value = config.git.branch || "main";
  }

  // 更新状态显示
  if (config.repo || (config.git && config.git.repoUrl)) {
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
  const syncType = document.getElementById("sync-type").value;
  let repoPath, branch, token;
  
  if (syncType === "github") {
    repoPath = document.getElementById("repo-url").value.trim();
    token = document.getElementById("github-token").value.trim();
    
    if (!repoPath) {
      showNotification("请输入GitHub仓库地址", "error");
      return;
    }
  } else {
    repoPath = document.getElementById("git-repo-url").value.trim();
    branch = document.getElementById("git-branch").value.trim() || "main";
    
    if (!repoPath) {
      showNotification("请输入Git仓库地址", "error");
      return;
    }
  }
  
  // 显示加载状态
  const loader = document.getElementById("loader");
  loader.style.display = "inline-block";
  const fetchBtn = document.getElementById("fetch-btn");
  if (fetchBtn) fetchBtn.disabled = true;

  try {
    // 构建请求URL
    let url = `/cgi-bin/get-repo-files?repoPath=${encodeURIComponent(repoPath)}`;
    
    if (syncType === "git") {
      url += `&syncType=git&branch=${encodeURIComponent(branch)}`;
    } else if (token) {
      url += `&token=${encodeURIComponent(token)}`;
    }
    
    // 默认使用缓存，不强制更新
    url += "&forceUpdate=false";
    
    // 发送请求到后端API获取仓库文件
    const response = await fetch(url);

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
    if (fetchBtn) fetchBtn.disabled = false;
  }
}

// Handle save configuration button click
async function handleSaveConfig() {
  const syncType = document.getElementById("sync-type").value;
  let configData = {};

  if (syncType === "github") {
    const repo = document.getElementById("repo-url").value.trim();
    const token = document.getElementById("github-token").value.trim();

    if (!repo) {
      showNotification("请输入GitHub仓库地址", "error");
      return;
    }

    configData = {
      syncType,
      repo,
      token
    };
  } else {
    const gitRepoUrl = document.getElementById("git-repo-url").value.trim();
    const gitBranch = document.getElementById("git-branch").value.trim();

    if (!gitRepoUrl) {
      showNotification("请输入Git仓库地址", "error");
      return;
    }

    configData = {
      syncType,
      git: {
        repoUrl: gitRepoUrl,
        branch: gitBranch || "main"
      }
    };
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
      body: JSON.stringify(configData),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "保存配置失败");
    }

    // 处理冲突情况
    if (result.conflict) {
      const overwrite = confirm(result.message || "检测到冲突。是否要覆盖？");
      
      if (overwrite) {
        // 用户选择覆盖，添加强制标志重新提交
        configData.force = true;
        
        const forceResponse = await fetch("/cgi-bin/save-config", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(configData),
        });
        
        const forceResult = await forceResponse.json();
        
        if (!forceResponse.ok) {
          throw new Error(forceResult.error || "操作失败");
        }
        
        showNotification(forceResult.message || "配置保存成功！");
      } else {
        showNotification("操作已取消", "error");
      }
    } else {
      showNotification(result.message || "配置保存成功！");
    }

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

// 从远程Git同步到本地
async function handleSyncFromRemote() {
  const loader = document.getElementById("loader");
  loader.style.display = "inline-block";
  document.getElementById("sync-from-remote").disabled = true;
  
  try {

    const response = await fetch("/cgi-bin/git-sync-from-remote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || "从远程同步失败");
    }
    
    // 处理冲突情况
    if (result.conflict) {
      const overwrite = confirm(result.message || "检测到冲突。是否要覆盖本地版本？");
      
      if (overwrite) {
        // 用户选择覆盖本地，发送强制同步请求
        const forceResponse = await fetch("/cgi-bin/git-sync-from-remote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ force: true }),
        });
        
        const forceResult = await forceResponse.json();
        
        if (!forceResponse.ok) {
          throw new Error(forceResult.error || "操作失败");
        }
        
        showNotification(forceResult.message || "从远程同步成功！");
      } else {
        showNotification("操作已取消", "error");
      }
    } else {
      showNotification(result.message || "从远程同步成功！");
    }
  } catch (error) {
    showNotification(`同步失败: ${error.message}`, "error");
  } finally {
    loader.style.display = "none";
    document.getElementById("sync-from-remote").disabled = false;
  }
}

// 同步到远程Git仓库
async function handleSyncToRemote() {
  const loader = document.getElementById("loader");
  loader.style.display = "inline-block";
  document.getElementById("sync-to-remote").disabled = true;
  
  try {
    const response = await fetch("/cgi-bin/git-sync-to-remote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || "同步到远程失败");
    }
    
    // 处理冲突情况
    if (result.conflict) {
      const overwrite = confirm(result.message || "检测到冲突。是否要覆盖远程版本？");
      
      if (overwrite) {
        // 用户选择覆盖远程，发送强制同步请求
        const forceResponse = await fetch("/cgi-bin/git-sync-to-remote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ force: true }),
        });
        
        const forceResult = await forceResponse.json();
        
        if (!forceResponse.ok) {
          throw new Error(forceResult.error || "操作失败");
        }
        
        showNotification(forceResult.message || "同步到远程成功！");
      } else {
        showNotification("操作已取消", "error");
      }
    } else {
      showNotification(result.message || "同步到远程成功！");
    }
  } catch (error) {
    showNotification(`同步失败: ${error.message}`, "error");
  } finally {
    loader.style.display = "none";
    document.getElementById("sync-to-remote").disabled = false;
  }
}

// 处理GitHub同步按钮点击
async function handleGithubSync() {
  const loader = document.getElementById("loader");
  loader.style.display = "inline-block";
  document.getElementById("github-sync-btn").disabled = true;
  
  try {
    const response = await fetch("/cgi-bin/github-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || "GitHub同步失败");
    }
    
    showNotification(result.message || "GitHub同步成功！");
    
    // 更新最后同步时间
    const date = new Date();
    document.getElementById("last-updated").textContent = date.toLocaleString("zh-CN");
  } catch (error) {
    showNotification(`GitHub同步失败: ${error.message}`, "error");
  } finally {
    loader.style.display = "none";
    document.getElementById("github-sync-btn").disabled = false;
  }
}
