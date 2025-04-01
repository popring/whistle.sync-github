import { getFileContent } from "./githubService";
import { getRepositoryFiles } from "./githubService";
import { config } from "../config";

export const getAllValues = async () => {
  const files = await getRepositoryFiles(config.repo);
  const res: Record<string, string> = {};

  for (const file of files) {
    const content = await getFileContent(config.repo, file);
    if (!content.startsWith("# Rules")) {
      res[file] = content;
    }
  }

  return res;
};
