+++
date = '2025-04-29T19:21:47+08:00'
draft = false
title = '我是学生，送我——使用Microsoft Azure配置云主机'
showSummary = true
summary = "记录了自己决定搞一个免费的云主机玩玩的全过程，以及一些科普和吐槽。"
tags = ["折腾", "教程", "vps", "云主机", "server", "free", "薅羊毛"]
categories = ["TechPlay"]
showTableOfContents = true
showAuthorBottom = true
showBreadcrumbs = true
showDate = true
showDateUpdated = true
showHeadingAnchors = true
showTaxonomies = true
showComments = true
showViews = true
showLikes = true
+++

写下这些文字的时候，本站正处于⭐**寄掉**⭐的状态——服务器使用校园网，
而用`curl`认证的校园网时不时会断开（据室友经验,是不小心连上了无线网导致的）；ssh又发电了，可能是因为我的环境从宿舍变成了教室，
主机的ip地址从`10.xx`变成`172.26.xxx`，这就导致我无法连接还在宿舍的服务器来配置网络。[^1]为了让网站不那么鸡肋，同时满足折腾的精神需求，
我决定~~在这次近代史课上~~尝试配置一个云主机，并记录过程与遇到的问题。 

## 开始配置之前

### 关于VPS

VPS（`Virtual Private Server`，虚拟专用服务器）是使用虚拟化技术，在一台物理服务器上划分出的多个独立“虚拟服务器”。
每个 VPS 都拥有自己的操作系统、存储空间、CPU、内存和网络接口，就像一个小型的云服务器。 

VPS 通常运行在大型云平台（如 微软的 Azure、亚马逊的AWS、阿里云）之上，这些平台拥有大量的公网 IP 资源。云平台为了让用户能远程连接 VPS（如 SSH、RDP），通常会：
为每台 VPS 自动或手动分配一个 公网 IPv4 地址，并且
公网 IP 直接绑定到该 VPS 的网络接口，或通过 NAT 映射，也就变相地获得了一个公网ip地址。

### 选择提供商

作为新手并不要求VPS服务的质量和硬件配置有多好，所以只会寻找免费服务，参考了[这篇博客文章](https://uuzi.net/2024-free-vps-recommend/)。
总结下来，只有甲骨文(Oracle)可以永久白嫖服务器，但是注册非常麻烦，并且**需要一个支持国际货币的 visa 卡**，实在懒得办了。
而 Azure 服务会为学生提供每年 100 美金的免费额度，只需要一个 `edu` 邮箱就可以申请，所以我选择了Azure. 

{{< figure src="送我.jpg" title="我是学生，送我！" >}}

## 配置 Azure

主要参考[这篇文章](https://blog.csdn.net/qq_33177599/article/details/132333921)。这篇文章已经非常详细了，配置过程中没有遇到任何问题（除了云主机涨价），至福！

{{< alert >}}
OMG It's CSDN💩!

推荐搭配净化 CSDN 脚本使用；希望你点开链接之前，这篇文章不会成为 💩VIP💩 专属。
{{< /alert >}}



## 下一步……?

没想到获取一个ip地址这么容易，也没想到服务器连不上的原因这么抽象[^1]。总之，既然两个主机都挺稳定的，
可以考虑让这两个服务器一起负责为这个网站服务，做负载均衡。

[^1]:  Well actually🤓👆, 以上整个推论都是错误的。在写完这篇后回寝室发现，内外网都断了——但只是因为我中午不小心碰了一下主机导致网线松动，
没有连上。

