import simpleGit, { SimpleGit } from "simple-git";
import fs from "fs";
import path from "path";
import { config } from "../config";

// 临时目录，用于Git操作
const TMP_DIR = path.join(__dirname, "../../.git-tmp");

// 确保临时目录存在
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

/**
 * 从仓库URL中提取仓库名称
 * @param repoUrl Git仓库URL
 * @returns 仓库名称
 */
function getRepoDir(repoUrl: string): string {
  // 从URL中提取仓库名称
  let repoName = repoUrl.split("/").pop()?.replace(".git", "") || "repo";

  return path.join(TMP_DIR, repoName);
}

/**
 * 初始化Git仓库
 * @param repoUrl Git仓库URL
 * @param branch 分支名称
 * @returns 初始化的Git实例
 */
async function initGitRepo(
  repoUrl: string,
  branch: string = "main"
): Promise<SimpleGit> {
  // 为当前仓库创建特定的目录
  const repoDir = getRepoDir(repoUrl);

  // 确保仓库目录存在
  if (!fs.existsSync(repoDir)) {
    fs.mkdirSync(repoDir, { recursive: true });
  }

  console.log("初始化Git仓库到", repoDir);

  const git = simpleGit(repoDir);

  // 检查是否已经是Git仓库（检查.git目录是否存在）
  const isRepo = fs.existsSync(path.join(repoDir, ".git"));

  if (!isRepo) {
    console.log("不是Git仓库，克隆远程仓库...");
    // 如果不是Git仓库，则执行克隆操作
    // 先清空目录
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
      fs.mkdirSync(repoDir, { recursive: true });
    }

    // 使用clone操作而不是init + remote
    await git.clone(repoUrl, repoDir);

    // 克隆之后切换到指定分支
    await git.checkout(branch);
  } else {
    console.log("已是Git仓库，更新远程URL...");
    // 如果已经是Git仓库，检查远程仓库URL是否与当前配置一致
    const remotes = await git.getRemotes(true);
    const originRemote = remotes.find((remote) => remote.name === "origin");
    if (!originRemote || originRemote.refs.fetch !== repoUrl) {
      // 如果不一致，重新设置远程仓库
      try {
        await git.removeRemote("origin");
      } catch (error) {
        // 忽略移除可能的错误
      }
      await git.addRemote("origin", repoUrl);
    }
  }

  console.log("获取远程分支...");

  // 尝试获取远程分支
  try {
    await git.fetch("origin", branch);
  } catch (error) {
    throw new Error(`无法连接到Git仓库或分支不存在: ${error.message}`);
  }

  console.log("检出分支...");

  // 检出指定分支
  try {
    // 尝试切换到指定分支
    await git.checkout(branch);
    console.log("拉取最新代码...");
    await git.pull("origin", branch, ["--rebase"]);
  } catch (error) {
    console.log("分支可能不存在，创建新分支:", error);
    // 如果分支不存在，则创建新分支
    await git.checkout(["-b", branch]);
  }

  console.log("initGitRepo success");

  return git;
}

function checkGitRepo(repoUrl: string) {
  const repoDir = getRepoDir(repoUrl);
  return fs.existsSync(repoDir) && repoDir;
}

/**
 * 从Git仓库获取文件列表
 * @param repoUrl 仓库URL
 * @returns 文件列表
 */
export async function getRepositoryFiles(
  repoUrl: string,
): Promise<Record<string, string>> {
  if (!config.git?.repoUrl) {
    throw new Error("未配置Git仓库");
  }
  try {
    const repoDir = checkGitRepo(repoUrl);
    if (!repoDir) {
      throw new Error("Git仓库不存在");
    }

    const filesContent: Record<string, string> = {};
    const readDir = (dir: string) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (item === ".git") continue;

        const fullPath = path.join(dir, item);
        const relativePath = path.relative(repoDir, fullPath);

        if (fs.lstatSync(fullPath).isDirectory()) {
          readDir(fullPath);
        } else {
          filesContent[relativePath] = fs.readFileSync(fullPath, "utf-8");
        }
      }
    };

    readDir(repoDir);

    return filesContent;
  } catch (error) {
    console.error("获取Git仓库文件失败:", error);
    throw new Error(`获取Git仓库文件失败: ${error.message}`);
  }
}

/**
 * 获取单个文件内容
 * @param repoUrl 仓库URL
 * @param filePath 文件路径
 * @param branch 分支名
 * @param forceUpdate 是否强制更新(此参数保留，但不再有缓存功能)
 * @returns 文件内容
 */
export async function getFileContent(
  repoUrl: string,
  filePath: string,
  branch: string = "main",
  forceUpdate: boolean = false
): Promise<string> {
  try {
    // 从仓库获取
    const git = await initGitRepo(repoUrl, branch);
    const repoDir = getRepoDir(repoUrl);

    const fullPath = path.join(repoDir, filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const content = fs.readFileSync(fullPath, "utf-8");

    return content;
  } catch (error) {
    console.error("获取文件内容失败:", error);
    throw new Error(`获取文件内容失败: ${error.message}`);
  }
}

/**
 * 检查远程仓库是否有新版本可用
 * @returns 是否有更新
 */
export async function checkRemoteUpdates(): Promise<boolean> {
  if (!config.git?.repoUrl) {
    throw new Error("未配置Git仓库");
  }

  try {
    const git = await initGitRepo(config.git.repoUrl, config.git.branch);

    // 获取当前分支
    const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);

    // 先获取远程更新
    await git.fetch("origin", config.git.branch);

    // 比较本地和远程分支的差异
    const diff = await git.diff([
      `${currentBranch}..origin/${config.git.branch}`,
    ]);

    // 如果有差异，则有可用更新
    return diff.trim() !== "";
  } catch (error) {
    console.error("检查更新失败:", error);
    throw new Error(`检查更新失败: ${error.message}`);
  }
}

/**
 * 获取本地与远程仓库的冲突状态
 * @returns 冲突状态信息
 */
export async function getConflictStatus(): Promise<{
  hasLocalChanges: boolean;
  behindRemote: boolean;
  aheadOfRemote: boolean;
}> {
  if (!config.git?.repoUrl) {
    throw new Error("未配置Git仓库");
  }

  try {
    const git = await initGitRepo(config.git.repoUrl, config.git.branch);

    // 检查本地修改
    const status = await git.status();
    const hasLocalChanges =
      status.modified.length > 0 ||
      status.created.length > 0 ||
      status.deleted.length > 0;

    // 检查与远程的差异
    await git.fetch("origin", config.git.branch);
    const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);

    // 获取本地分支和远程分支之间的commit差异
    const revs = await git.raw([
      "rev-list",
      "--left-right",
      "--count",
      `${currentBranch}...origin/${config.git.branch}`,
    ]);
    const [ahead, behind] = revs.trim().split("\t").map(Number);

    return {
      hasLocalChanges,
      aheadOfRemote: ahead > 0,
      behindRemote: behind > 0,
    };
  } catch (error) {
    console.error("获取冲突状态失败:", error);
    throw new Error(`获取冲突状态失败: ${error.message}`);
  }
}

/**
 * 将本地配置同步到远程仓库
 * @param force 是否强制覆盖远程冲突
 * @returns 同步结果
 */
export async function syncToRemote(force: boolean = false): Promise<{
  success: boolean;
  message: string;
  conflict?: boolean;
}> {
  if (!config.git?.repoUrl) {
    throw new Error("未配置Git仓库");
  }

  try {
    const git = await initGitRepo(config.git.repoUrl, config.git.branch);

    // 检查冲突状态
    const conflictStatus = await getConflictStatus();

    // 如果远程有更新且不强制覆盖，则中止操作
    if (conflictStatus.behindRemote && !force) {
      return {
        success: false,
        message: "远程仓库有新的更新，是否要覆盖远程版本？",
        conflict: true,
      };
    }

    // 添加修改
    await git.add(".");

    // 提交更改
    await git.commit("通过Whistle.sync-git自动更新");

    // 如果启用强制推送，使用--force选项
    if (force) {
      await git.push("origin", config.git.branch, ["--force"]);
    } else {
      await git.push("origin", config.git.branch);
    }

    return {
      success: true,
      message: "成功同步到远程仓库",
    };
  } catch (error) {
    console.error("同步到远程仓库失败:", error);
    throw new Error(`同步到远程仓库失败: ${error.message}`);
  }
}

/**
 * 从远程仓库同步配置到本地
 * @param force 是否强制覆盖本地冲突
 * @returns 同步结果
 */
export async function syncFromRemote(force: boolean = false): Promise<{
  success: boolean;
  message: string;
  conflict?: boolean;
}> {
  if (!config.git?.repoUrl) {
    throw new Error("未配置Git仓库");
  }
  console.log("从远程同步");

  try {
    const git = await initGitRepo(config.git.repoUrl, config.git.branch);
    console.log("git111111,", git);
    // 检查冲突状态
    const conflictStatus = await getConflictStatus();

    // 如果本地有修改且不强制覆盖，则中止操作
    if (conflictStatus.hasLocalChanges && !force) {
      return {
        success: false,
        message: "本地有未提交的修改，是否要覆盖本地版本？",
        conflict: true,
      };
    }

    // 如果强制覆盖，先丢弃本地修改
    if (force && conflictStatus.hasLocalChanges) {
      await git.reset(["--hard"]);
      await git.clean("f");
    }

    // 拉取最新更改
    await git.pull("origin", config.git.branch);

    return {
      success: true,
      message: "成功从远程仓库同步",
    };
  } catch (error) {
    console.error("从远程仓库同步失败:", error);
    throw new Error(`从远程仓库同步失败: ${error.message}`);
  }
}
