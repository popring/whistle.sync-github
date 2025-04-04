import { config, Config } from "../config";
import path from "path";
import fs from "fs";

/**
 * 验证文件夹路径是否安全 (不超出仓库根目录)
 * @param folderPath 文件夹路径
 * @returns 是否安全
 */
function isPathSafe(folderPath: string): boolean {
  // 检查路径是否包含危险部分，如 ".." 
  const normalizedPath = path.normalize(folderPath);
  if (normalizedPath.includes("..") || normalizedPath.startsWith("/") || normalizedPath.startsWith("\\")) {
    return false;
  }
  return true;
}

/**
 * 获取配置信息
 * @returns 当前配置
 */
export async function getGitHubConfig() {
  return Promise.resolve(config);
}

/**
 * 保存GitHub仓库配置
 */
export async function saveGitHubConfig(
  repo: string,
  token: string,
  syncType?: "github" | "git",
  gitConfig?: Config["git"]
) {
  try {
    // 设置同步类型
    config.syncType = syncType || "github";
    
    if (syncType === "git" && gitConfig) {
      // 保存Git配置
      // 验证必填字段
      if (!gitConfig.repoUrl) {
        throw new Error("Git仓库地址不能为空");
      }
      
      // 验证rules和values文件夹
      if (!gitConfig.rulesFolder) {
        throw new Error("Rules文件夹路径不能为空");
      }
      
      if (!gitConfig.valuesFolder) {
        throw new Error("Values文件夹路径不能为空");
      }
      
      // 验证两个路径不能相同
      if (gitConfig.rulesFolder === gitConfig.valuesFolder) {
        throw new Error("Rules文件夹和Values文件夹路径不能相同");
      }
      
      // 验证路径安全性
      if (!isPathSafe(gitConfig.rulesFolder) || !isPathSafe(gitConfig.valuesFolder)) {
        throw new Error("文件夹路径不能包含 .. 或绝对路径");
      }
      
      config.git = gitConfig;
    } else {
      // 保存GitHub配置
      if (!repo) {
        throw new Error("GitHub仓库地址不能为空");
      }
      
      config.repo = repo;
      config.token = token;
    }
    
    config.lastSync = new Date().toISOString();

    return {
      success: true,
      message: "配置已保存",
      data: config
    };
  } catch (error) {
    console.error("保存配置失败:", error);
    throw new Error(`保存配置失败: ${error.message}`);
  }
} 