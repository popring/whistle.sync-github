import axios from "axios";
import { config } from "../config";

// 缓存机制，存储已获取的文件列表和内容
interface Cache {
  files: Map<string, string[]>;
  contents: Map<string, Map<string, string>>;
  lastSync: Date | null;
}

const cache: Cache = {
  files: new Map(), // 仓库路径 -> 文件列表
  contents: new Map(), // 仓库路径 -> (文件路径 -> 文件内容)
  lastSync: null,
};

// Recursively fetch all files in a repository
async function getRepositoryFiles(repoPath: string, path = "", forceUpdate: boolean = false): Promise<string[]> {
  // 检查缓存，如果有且不强制更新，直接返回
  if (!forceUpdate && cache.files.has(repoPath)) {
    console.log("使用GitHub缓存的文件列表");
    return cache.files.get(repoPath) || [];
  }
  
  // Process repo path to handle various input formats
  repoPath = repoPath.trim();

  // Handle full GitHub URLs
  if (repoPath.startsWith("http")) {
    const urlParts = repoPath.split("/");
    // Extract owner and repo from URL
    // Format: https://github.com/owner/repo
    const ownerIndex = urlParts.indexOf("github.com") + 1;
    if (ownerIndex > 0 && ownerIndex < urlParts.length - 1) {
      repoPath = `${urlParts[ownerIndex]}/${urlParts[ownerIndex + 1]}`;
    } else {
      throw new Error('无法从URL解析仓库地址，请使用格式 "用户名/仓库名"');
    }
  }

  // Ensure repoPath is in the format "owner/repo"
  if (!repoPath.includes("/")) {
    throw new Error('仓库地址格式应为 "用户名/仓库名"');
  }

  const url = `https://api.github.com/repos/${repoPath}/contents${
    path ? `/${path}` : ""
  }`;

  // Add required headers for GitHub API
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Whistle-GitHub-Sync",
  };

  // Add token if available (for authenticated requests)
  if (config.token) {
    headers["Authorization"] = `Bearer ${config.token}`;
  }

  const response = await axios.get(url, { headers });

  if (response.status !== 200) {
    if (response.status === 404) {
      throw new Error("找不到指定的仓库或路径，请检查仓库地址是否正确");
    } else if (
      response.status === 403 &&
      response.headers["X-RateLimit-Remaining"] === "0"
    ) {
      throw new Error("GitHub API 请求次数已达上限，请稍后再试");
    }
    throw new Error(
      `GitHub API错误: ${response.status} ${response.statusText}`
    );
  }

  const contents = response.data;
  let files: string[] = [];

  // Handle both array response (directory) and object response (single file)
  const items = Array.isArray(contents) ? contents : [contents];

  for (const item of items) {
    if (item.type === "file") {
      files.push(item.path);
    } else if (item.type === "dir") {
      const dirFiles = await getRepositoryFiles(repoPath, item.path);
      files = files.concat(dirFiles);
    }
  }
  
  // 更新缓存
  cache.files.set(repoPath, files);
  cache.lastSync = new Date();

  return files;
}

async function getFileContent(
  repoPath: string,
  filePath: string,
  forceUpdate: boolean = false
): Promise<string> {
  // 检查缓存，如果有且不强制更新，直接返回
  if (!forceUpdate && 
      cache.contents.has(repoPath) && 
      cache.contents.get(repoPath)?.has(filePath)) {
    console.log(`使用GitHub缓存的文件内容: ${filePath}`);
    return cache.contents.get(repoPath)?.get(filePath) || "";
  }
  
  if (!repoPath || !filePath) {
    throw new Error("仓库路径和文件路径不能为空");
  }

  const url = `https://api.github.com/repos/${repoPath}/contents/${filePath}`;

  // 添加GitHub API所需的请求头
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Whistle-GitHub-Sync",
  };

  // 如果提供了token，添加到请求头中
  if (config.token) {
    headers["Authorization"] = `Bearer ${config.token}`;
  }

  try {
    const response = await axios.get(url, { headers });

    if (response.status !== 200) {
      if (response.status === 404) {
        throw new Error("找不到指定的文件，请检查文件路径是否正确");
      } else if (
        response.status === 403 &&
        response.headers["X-RateLimit-Remaining"] === "0"
      ) {
        throw new Error("GitHub API 请求次数已达上限，请稍后再试");
      }
      throw new Error(
        `GitHub API错误: ${response.status} ${response.statusText}`
      );
    }

    // GitHub API返回的文件内容是Base64编码的
    const content = response.data.content;
    const encoding = response.data.encoding;

    if (encoding === "base64") {
      // 解码Base64内容
      const decodedContent = Buffer.from(content, "base64").toString("utf-8");
      
      // 更新缓存
      if (!cache.contents.has(repoPath)) {
        cache.contents.set(repoPath, new Map());
      }
      cache.contents.get(repoPath)?.set(filePath, decodedContent);
      
      return decodedContent;
    } else {
      throw new Error(`不支持的编码格式: ${encoding}`);
    }
  } catch (error) {
    if (error.response) {
      const { status, data } = error.response;
      throw new Error(
        `获取文件内容失败: ${status} - ${data.message || "未知错误"}`
      );
    }
    throw error;
  }
}

/**
 * 清除缓存，强制下次请求从远程获取
 */
function clearCache() {
  cache.files.clear();
  cache.contents.clear();
  cache.lastSync = null;
  console.log("已清除GitHub缓存");
}

/**
 * 获取最后同步时间
 * @returns 最后同步时间
 */
function getLastSyncTime(): Date | null {
  return cache.lastSync;
}

/**
 * 从远程GitHub仓库同步数据（强制刷新缓存）
 */
async function syncFromRemote(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    if (!config.repo) {
      throw new Error("未配置GitHub仓库");
    }
    
    // 强制从远程获取最新文件列表
    await getRepositoryFiles(config.repo, "", true);
    
    // 清除内容缓存，文件内容将在下次请求时按需获取
    if (cache.contents.has(config.repo)) {
      cache.contents.delete(config.repo);
    }
    
    return {
      success: true,
      message: "成功从GitHub仓库同步"
    };
  } catch (error) {
    console.error("从GitHub同步失败:", error);
    throw new Error(`从GitHub同步失败: ${error.message}`);
  }
}

export { 
  getRepositoryFiles, 
  getFileContent, 
  clearCache, 
  getLastSyncTime,
  syncFromRemote
};
