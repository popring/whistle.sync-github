import fs from "fs";
import path from "path";

type GitConfig = {
  repoUrl: string;
  branch: string;
  rulesFolder?: string;
  valuesFolder?: string;
};

type Config = {
  syncType?: "github" | "git";
  token: string;
  repo: string;
  lastSync: string;
  git?: GitConfig;
  [key: string | symbol]: any;
};

const configPath = path.join(__dirname, "../config.json");

function loadConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify({}, null, 2), "utf8");
    }
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    console.error("Error reading config file:", error);
    return {};
  }
}

function saveConfig(config: Config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing config file:", error);
  }
}

const rawConfig = loadConfig();

const config = new Proxy<Config>(rawConfig, {
  set(target, key, value) {
    target[key] = value;
    saveConfig(target);
    return true;
  },
  get(target, key) {
    if (typeof target[key] === "object" && target[key] !== null) {
      return new Proxy(target[key], this);
    }
    return target[key];
  },
});

export { config };
export type { Config };
