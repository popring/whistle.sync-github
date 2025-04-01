# whistle.sync-github
> 使用该插件建议用最新版本的 [whistle](https://wproxy.org/whistle/update.html)

该插件从 github 拉取 Rules, Values 配置。

# 安装
1. 首先需要安装最新版 [whistle](https://github.com/avwo/whistle)，如果你的机器已经安装了 whistle，请确保 whistle 为最新版本：
    - 安装及如何使用 whistle 参见 [Github](https://github.com/avwo/whistle)
    - 如何升级 whistle 参见[帮助文档](http://wproxy.org/whistle/update.html)。
2. 安装inspect插件：
    ```
    w2 i whistle.sync-github
    ```
    > 或使用 cnpm 镜像 `w2 i whistle.sync-github --registry=https://registry.nlark.com`
    > 如果已安装 cnpm，还可以用 `w2 ci whistle.sync-github`

# github 保存配置

将需要备份的配置上传到仓库即可

文件内容若以 `# Rules` 则视为 Rules 配置，其他均为 Values 配置。

# 使用

- 打开 `https://local.whistlejs.com/#plugins` ， 进入 plugin 页面，点击 whistle.sync-github `option` 进入配置，填写完成后点击保存配置
- 返回插件列表页，点击 sync 进行同步，弹出弹窗选择 Rules/Values，点击即可拉取 github 仓库文件。

