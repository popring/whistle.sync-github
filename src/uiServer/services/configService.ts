import { config, Config } from "../config";

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
      config.git = gitConfig;
      
      // 验证必填字段
      if (!gitConfig.repoUrl) {
        throw new Error("Git仓库地址不能为空");
      }
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