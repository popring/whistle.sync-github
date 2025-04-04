import {
  getFileContent as getGithubFileContent,
  getGithubRepositoryFiles,
} from "./githubService";
import {
  getFileContent as getGitFileContent,
  getRepositoryFiles as getGitRepositoryFiles,
} from "./gitService";
import { config } from "../config";

export const getAllValues = async () => {
  try {
    // 根据配置的同步类型选择不同的服务
    const syncType = config.syncType || "github";

    // 创建结果对象
    const res: Record<string, string> = {};

    if (syncType === "git") {
      const filesContent = await getGitRepositoryFiles(
        config.git.valuesFolder
      );
      return filesContent;
    } else {
      // 使用GitHub同步
      if (!config.repo) {
        throw new Error("未配置GitHub仓库");
      }

      const files = await getGithubRepositoryFiles(config.repo);

      // 使用并行处理获取文件内容
      await processFiles(files, res, syncType, config.repo);

      return res;
    }
  } catch (error) {
    console.error("[values] 获取值失败:", error);
    throw error;
  }
};

// 并行处理文件获取内容
async function processFiles(
  files: string[],
  result: Record<string, string>,
  syncType: string,
  repoPath: string,
  branch?: string
): Promise<void> {
  // 限制并发请求数量，避免过多请求导致服务不稳定
  const CONCURRENCY_LIMIT = 5;

  // 创建一个函数来处理单个文件
  const processFile = async (file: string) => {
    try {
      let content;
      if (syncType === "git") {
        content = await getGitFileContent(repoPath, file, branch || "main");
      } else {
        content = await getGithubFileContent(repoPath, file);
      }

      // 只保留非规则文件
      if (!content.startsWith("# Rules")) {
        result[file] = content;
      }
    } catch (error) {
      console.error(`获取文件内容失败: ${file}`, error);
      // 不让单个文件失败影响整体结果
    }
  };

  // 分批处理文件，控制并发数
  for (let i = 0; i < files.length; i += CONCURRENCY_LIMIT) {
    const batch = files.slice(i, i + CONCURRENCY_LIMIT);
    await Promise.all(batch.map(processFile));
  }
}
