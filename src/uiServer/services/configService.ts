import { config } from "../config";

/**
 * 获取GitHub仓库配置
 * @returns 当前GitHub配置
 */
export async function getGitHubConfig() {
  return Promise.resolve(config);
}

export async function saveGitHubConfig(
  repo: string,
  token: string,
) {
  if (!repo) {
    throw new Error("GitHub仓库地址不能为空");
  }

  try {
    config.repo = repo;
    config.token = token;
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