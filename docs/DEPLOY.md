# 部署 CloseCall

持久目录 `/opt/closecall-s2/data`，运行环境 `/opt/closecall-s2/runtime.env`（root 600），独立 release 目录。Next standalone 与静态文件只读挂载，uid 1000，限制内存384MB、CPU0.5。worker 是独立 Node 进程，15秒轮询内部 `/api/cron`；凭据不出现在命令输出或网页。

东京实例沿用已授权的腾讯云 TAT 进行部署。独立域名 `closecall.43.167.174.154.nip.io`，仅经既有 Caddy HTTPS反向代理；应用端口不直接开放公网。上线时核验已有网站和 Afterbell，不购买新服务。

低内存构建：Node24 官方镜像，Webpack 单工作线程，构建容器768MB/1CPU，并保留服务器交换空间。运行时无需在服务器安装GitHub凭据。

生产 `CLOSECALL_DB_PATH=/app/data/closecall.sqlite`，`CLOSECALL_INTERNAL_URL=http://app:3000` 用于 worker。两进程共享同一cron密钥，worker不直接访问数据库。不要把数据库、日志、`.env*` 或个人判断上传源码仓库。

回滚：只替换 CloseCall 自身 release 绑定并重启其容器，保留 data 与 runtime.env。撤销域名时只移除 CloseCall 对应 Caddy 块，不能覆盖其他网站新增配置。

nip.io 为公共DNS服务，仍有可用性依赖。公用数据接口可能限流，不能把公共访问链接等同于商业级行情授权或SLA。
