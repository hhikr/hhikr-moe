+++
date = '2025-04-28T17:55:02+08:00'
draft = false
title = '记录我的第一次建站'
showSummary = true
summary = "第一次建站的一些经验。"
tags = ["折腾", "教程", "建站", "香橙派"]
categories = ["TechPlay"]
+++

在这个各种自动化工具都发展的十分健全的年代，建立静态托管的个人网站已经不再是一种非常geek的事情了，这甚至不比重装windows系统困难多少。建站的花费也是微乎其微：如果不执着于网站的域名，也不介意网站时不时无法访问，你甚至不需要花一分钱来达成这个目的；你需要的只是一个能够正常运行、受得了长时间开机的电脑罢了。不过，本站的建立还是比直接把html挂在`github page`要多出几步的，所谓折腾的乐趣大概就在这里吧（笑）。


## 自底向上的Overview 

本次建站中，我选择在本机`Arch Linux`系统上使用[Blowfish](https://blowfish.page/)主题的[Hugo](https://github.com/gohugoio/hugo)生成网站项目，再将其`public`文件夹下的网页文件上传至`Debian`系统的[香橙派](http://www.orangepi.cn/html/hardWare/computerAndMicrocontrollers/service-and-support/Orange-Pi-Zero-3.html)主机的`/var/www/hugo`上；香橙派作为服务器，[Nginx](https://zh.wikipedia.org/wiki/Nginx)监听80端口进行静态网页内容的调取，作为反向代理[^1]；[Cloudflare](https://www.cloudflare.com/zh-cn/)建立与服务器的隧道，提供外界访问的接口，作为第二个反向代理；最后，使用[Nameslio](https://www.namesilo.com/)购买该域名，并将DNS配置为Cloudflare提供的DNS。 

{{< figure src="featured.png" title="示意图" >}}


于是，当你的鼠标点击[https://hhikr.moe](https://hhikr.moe)后，上文提到的这些部件就会像一组齿轮一般，反向地连锁运行；而对于目前的这个网站，各种交互只不过是通过这组齿轮，间接地访问服务器中的 html 文件罢了。 

## 自顶向下的Breakdown 

### 1. Nameslio: 域名的购买

了解的不多，也没什么好说的。正常的`.com`域名五六十就可以买到，廉价的`.xyz`/`.top`域名更是可以夸张到两位数的价格就可以连续租用十年，`.moe`在 Nameslio 上价格较贵，但价格还是不到一百一年。 

域名也可以在某些网站上免费申请，不过可能面对审核周期长、难以备案等问题。 

### 2. Cloudflare: 大善人的余裕 

因为`moe`而多花几十已经够亏了，再去买个`ip`地址未免过于破费。而 Cloudflare 正好就可以实现不用自己买公网`ip`就可以实现外界访问的入站。它主要做了两件事： 

- 提供 DNS 服务器；
- 使用 Tunnel 服务，将服务器中的内容通过 Tunnel 向世界敞开。


<div style="position: relative; width: 100%; padding-top: 56.25%; /* 16:9比例 */ overflow: hidden; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
  <iframe
    src="//player.bilibili.com/player.html?isOutside=true&aid=1755356599&bvid=BV1H4421X7Wg&cid=1569261069&p=1"
    allowfullscreen="true"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; border-radius: 12px;">
  </iframe>
</div>


> cloudflare在本机浏览器中的配置几乎都是跟着这个视频来的（跟着做到建立tunnel之前），所以省略具体的配置内容，看视频吧。 

#### 一些科普

cloudflare是如何做到不需要提供公网ip也能使入站流量导向hhikr.moe? 

当然，不可能做到“不需要ip地址”；cloudflare的tunnel技术提供了所谓的内网出站[^2]的功能。
所谓“内网出站”，就是香橙派像浏览器访问网页一样，自己去连接外部服务器，这种连接在校园网、家庭宽带等没有公网IP的环境下是允许的[^3]，不需要路由器做特殊设置（比如端口映射）。
建立隧道后，Cloudflare服务器就能通过这条香橙派主动打通的通道，把世界各地的访问流量安全地传给香橙派，从而实现即使没有公网IP，网站也可以被所有人访问。 

换句话说，香橙派用 cloudflared 程序，
主动去连接 Cloudflare 的服务器（出站连接），
这条连接就是一个持久保持的加密通道（Tunnel，隧道），
Cloudflare那边可以通过这条隧道“推送”用户的请求过来。 



<br>

> Cloudflare 为托管的网站免费提供了许多服务，可谓是互联网带善人了，有空会多研究研究。（这算开坑吗？）

### 3. Nginx & Orange Pi

通过`ssh`服务连接至香橙派主机，在其上进行 Cloudflare 服务、Nginx托管的相关配置。 

#### 连接`ssh`遇到的问题 

校园网环境内，服务器的ssh连接遇到了严重的连接问题，并且十分玄学，具体表现是我的主力电脑和手机（使用Termmius软件）都无法连接`ssh`，舍友的手机秒连，
但是舍友的电脑一样连接不上。但是给香橙派插上主机后连接就没有任何问题了。只能推断是对不同段ip,校园网的管理员配置不一样，因为插网线后内网ip从10开头变成了
172开头（但是主力电脑上的ip一直是10开头）。 

#### 配置流程

##### 传输脚本

编写脚本，将本地的文件传输至服务器。使用`rsync`指令，这一部分也是需要`ssh`的。 

```bash
#!/bin/bash

# ===================== 配置区 ===================== #
DEFAULT_USER="orangepi"
DEFAULT_HOST="114.514.19.19"
REMOTE_DIR="/var/www/hugo"
DEPLOY_LOG="$HOME/.hugo_deploy.log"
URL="https://hhikr.moe"
# ================================================== #

echo "🌐 当前配置："
echo "用户：$DEFAULT_USER"
echo "IP地址：$DEFAULT_HOST"
echo "远程目录：$REMOTE_DIR"
echo ""

# —— 是否更换 IP 地址？——
read -p "当前的 IP 是 ${DEFAULT_HOST}，是否更换？(y/N): " change_ip
if [[ "$change_ip" =~ ^[Yy]$ ]]; then
    read -p "请输入新的 IP 地址: " new_ip
    if [[ -n "$new_ip" ]]; then
        DEFAULT_HOST="$new_ip"
        echo "✅ IP 更新为 $DEFAULT_HOST"
    else
        echo "⚠️ 未输入新 IP，继续使用默认 IP：$DEFAULT_HOST"
    fi
fi

# —— 输入 SSH 密码 —— 
read -s -p "请输入 SSH 密码（不会显示）: " SSHPASS
echo ""

echo ""
echo "📁 检查远程目录：$REMOTE_DIR"
read -p "是否继续部署到该目录？(Y/n): " confirm_dir
if [[ "$confirm_dir" =~ ^[Nn]$ ]]; then
    read -p "请输入新的远程目录路径: " REMOTE_DIR
fi

echo "🚧 开始构建 Hugo 项目..."
hugo 2> hugo-error.log
if [ $? -ne 0 ]; then
    echo "❌ Hugo 构建失败！错误日志保存在 hugo-error.log"
    exit 1
fi

echo "📤 正在上传静态文件到 ${DEFAULT_USER}@${DEFAULT_HOST}:${REMOTE_DIR} ..."
sshpass -p "$SSHPASS" rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no" ./public/ ${DEFAULT_USER}@${DEFAULT_HOST}:${REMOTE_DIR} | tee -a "$DEPLOY_LOG"

if [ $? -ne 0 ]; then
    echo "❌ 上传失败！请检查网络或 SSH 权限"
    exit 1
fi

echo ""
echo "✅ 部署成功！你的网站应该已经上线：$URL"

# —— 是否打开浏览器访问？（仅本机有图形界面时建议开启）——
if command -v xdg-open &> /dev/null; then
    read -p "是否现在在浏览器中打开网站？(Y/n): " open_browser
    if [[ ! "$open_browser" =~ ^[Nn]$ ]]; then
        xdg-open "$URL"
    fi
fi

echo "📜 部署日志已记录：$DEPLOY_LOG"
```

> 由于我几乎不会写bash脚本，这个脚本是由llm生成的，可能有很奇怪的地方。好在 It just works. 

##### Nginx配置 

配置Nginx，监听localhost的80端口，托管静态网页。

```bash
# 1. 创建站点目录
sudo mkdir -p /var/www/hugo
sudo chown -R $USER:$USER /var/www/hugo

# 2. 写入配置
sudo nvim /etc/nginx/sites-available/hugo

# 3. 启用配置
sudo ln -s /etc/nginx/sites-available/hugo /etc/nginx/sites-enabled/
# 建立静态连接将“可用网站”放在“已激活网站”下，所以Nginx就会从/etc/nginx/sites-enabled/寻找可以启动的网站。
sudo nginx -t
# -t代表test,用于测试Nginx配置是否正确
sudo rm /etc/nginx/sites-enabled/default
# 删除默认界面，否则你可能会看到Nginx的默认界面而不是你的网站
sudo systemctl reload nginx
# 刷新服务，启动nginx
```

Nginx配置文件实例： 

```nginx
server {
    # 监听端口。为什么是80？因为cloudflare tunnel走的是http！
    listen 80;
    server_name hhikr.moe;

    root /var/www/hugo;
    # 首页。
    index index.html;
    
    # 如果路径存在，返回文件；否则返回 404
    location / {
        try_files $uri $uri/ =404;
    }
}
```

##### Cloudflare配置

1. 安装：根据官方教程安装。下面是官网提供的debian系安装流程。
```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg

echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main" | \
  sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt update
sudo apt install cloudflared -y
```
2. 登陆并创建tunnel 

```bash
# 登录 Cloudflare
cloudflared tunnel login
# 它会打开一个浏览器链接，在上面登录你的 Cloudflare 账户。

# 创建 tunnel
cloudflared tunnel create hhikr-moe-tunnel
# 会生成一个 .json 文件，路径如 /home/orangepi/.cloudflared/634b00...json
```

3. 配置 Cloudflare Tunnel，映射到本地 Nginx

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```
配置文件这么写：
```yaml
tunnel: hhikr-moe-tunnel
credentials-file: /home/orangepi/.cloudflared/634b00...json

ingress:
  - hostname: hhikr.moe
    service: http://localhost:80
  - service: http_status:404
```

4. 将tunnel与域名绑定，并启动tunnel

```bash
cloudflared tunnel route dns hhikr-moe-tunnel hhikr.moe

# 暂时启动，有输出，用于查看运行状态或debug
cloudflared tunnel run hhikr-moe-tunnel
# 永久启动，作为service运行，开机就会自动运行。
sudo cloudflared service install
```

> 至此，网站应该就可以正常运作了。おめでとう🎉


[^1]: 反向代理是一种服务器，它位于客户端和目标服务器之间，客户端以为自己直接连接的是目标服务器，但实际上所有请求都先到反向代理，由它再转发到真正的服务器；这样可以隐藏真实服务器地址、实现负载均衡、缓存内容，加速访问，提高安全性。
[^2]: 在网络通信里，出站（Outbound）指的是从你的设备主动发起请求到外部，入站（Inbound）指的是外部主动连接到你的设备。
[^3]: 没有公网ip的设备可以进行出站访问，但不能处理入站请求。