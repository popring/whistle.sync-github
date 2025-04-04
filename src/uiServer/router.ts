import Router from "koa-router";
import { getAllRules } from "./services/ruleService";
import { getAllValues } from "./services/valueService";
import { syncFromRemote as syncGithubFromRemote } from "./services/githubService";
import { saveGitHubConfig, getGitHubConfig } from "./services/configService";
import { Config } from "./config";
import * as gitService from "./services/gitService";

// For help see https://github.com/ZijianHe/koa-router#api-reference
export default (router: Router) => {
  router.get("/cgi-bin/rules", async (ctx) => {
    try {
      const rules = await getAllRules();
      ctx.body = rules;
    } catch (error) {
      ctx.body = JSON.stringify({
        error: error.message || "获取规则失败，请检查同步配置",
      });
      ctx.status = 500;
    }
  });

  router.get("/cgi-bin/values", async (ctx, next) => {
    try {
      const values = await getAllValues();
      ctx.body = values;
    } catch (error) {
      ctx.body = JSON.stringify({
        error: error.message || "获取值失败，请检查同步配置",
      });
      ctx.status = 500;
    }
  });

  router.get("/cgi-bin/get-config", async (ctx, next) => {
    try {
      const config = await getGitHubConfig();
      ctx.body = config;
    } catch (error) {
      ctx.body = { error: error.message };
      ctx.status = 500;
    }
  });

  router.post("/cgi-bin/save-config", async (ctx, next) => {
    try {
      const { syncType, repo, token, git, force } = ctx.request.body as Config & { force?: boolean };
      
      if (syncType === "git") {
        if (!git || !git.repoUrl) {
          ctx.body = { success: false, error: "Git仓库地址不能为空" };
          ctx.status = 400;
          return;
        }
        
        // 检查是否需要处理冲突
        if (git.repoUrl) {
          try {
            // 初始化临时仓库并检查冲突状态
            const conflictStatus = await gitService.getConflictStatus();
            
            // 如果有冲突且未指定强制操作，则返回冲突信息
            if ((conflictStatus.behindRemote || conflictStatus.hasLocalChanges) && !force) {
              ctx.body = {
                success: false,
                conflict: true,
                message: conflictStatus.hasLocalChanges 
                  ? '本地有未提交的修改，是否要覆盖本地版本？'
                  : '远程仓库有新的更新，是否要覆盖远程版本？'
              };
              return;
            }
          } catch (error) {
            // 首次配置时可能没有仓库，忽略错误
          }
        }
        
        const result = await saveGitHubConfig("", "", syncType, git);
        ctx.body = result;
      } else {
        // 默认或明确指定GitHub同步方式
        if (!repo) {
          ctx.body = { success: false, error: "仓库地址不能为空" };
          ctx.status = 400;
          return;
        }
        const result = await saveGitHubConfig(repo, token || "", "github");
        ctx.body = result;
      }
    } catch (error) {
      ctx.body = { success: false, error: error.message };
      ctx.status = 500;
    }
  });
  
  // 添加从Git远程仓库同步的路由
  router.post("/cgi-bin/git-sync-from-remote", async (ctx, next) => {
    try {
      const { force } = ctx.request.body as { force?: boolean };
      const result = await gitService.syncFromRemote(force);
      ctx.body = result;
    } catch (error) {
      ctx.body = { success: false, error: error.message };
      ctx.status = 500;
    }
  });
  
  // 添加同步到Git远程仓库的路由
  router.post("/cgi-bin/git-sync-to-remote", async (ctx, next) => {
    try {
      const { force } = ctx.request.body as { force?: boolean };
      const result = await gitService.syncToRemote(force);
      ctx.body = result;
    } catch (error) {
      ctx.body = { success: false, error: error.message };
      ctx.status = 500;
    }
  });
  
  // 添加从GitHub远程仓库同步的路由
  router.post("/cgi-bin/github-sync", async (ctx, next) => {
    try {
      const result = await syncGithubFromRemote();
      ctx.body = result;
    } catch (error) {
      ctx.body = { success: false, error: error.message };
      ctx.status = 500;
    }
  });
};
