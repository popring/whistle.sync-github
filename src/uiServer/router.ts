import Router from "koa-router";
import { getAllRules } from "./services/ruleService";
import { getAllValues } from "./services/valueService";
import { getRepositoryFiles } from "./services/githubService";
import { saveGitHubConfig, getGitHubConfig } from "./services/configService";
import { Config } from "./config";

// For help see https://github.com/ZijianHe/koa-router#api-reference
export default (router: Router) => {
  router.get("/cgi-bin/rules", async (ctx) => {
    const rules = await getAllRules();
    ctx.body = rules;
  });

  router.get("/cgi-bin/values", async (ctx, next) => {
    const values = await getAllValues();
    ctx.body = values;
  });
  
  router.get("/cgi-bin/get-repo-files", async (ctx, next) => {
    const repoPath = ctx.query.repoPath as string;
    try {
      ctx.body = await getRepositoryFiles(repoPath, "");
    } catch (error) {
      ctx.body = { error: error.message };
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
      const { repo, token } = ctx.request.body as Config;
      
      if (!repo) {
        ctx.body = { success: false, error: "仓库地址不能为空" };
        ctx.status = 400;
        return;
      }

      const result = await saveGitHubConfig(repo, token);
      ctx.body = result;
    } catch (error) {
      ctx.body = { success: false, error: error.message };
      ctx.status = 500;
    }
  });
};
