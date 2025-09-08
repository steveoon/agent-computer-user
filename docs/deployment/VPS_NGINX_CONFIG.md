# VPS Nginx 配置优化指南

## 问题描述

在 VPS 上运行应用时，与 Duliday API 的连接在同步进度 36% 时出现 `ECONNRESET` 错误，而相同的应用在 Vercel 上运行正常。这通常是由于代理服务器的超时设置或连接管理配置导致的。

## 建议的 Nginx 配置优化

基于你现有的配置（已经有 3600 秒超时），主要问题可能是缺少一些关键的连接管理设置。建议在现有配置基础上添加以下优化：

### 针对 ECONNRESET 问题的关键配置

```nginx
server {
    server_name recruiter-agent.duliday.com;

    # 增加请求体大小限制（如果需要处理大数据）
    client_max_body_size 50M;

    # 补充连接超时配置（你已有 read/send，需要添加 connect）
    proxy_connect_timeout 3600;  # 添加连接超时，与现有配置保持一致

    # 关键：优化 keepalive 设置
    keepalive_timeout 300s;
    keepalive_requests 100;

    # 针对同步 API 的特殊 location 块（优先级更高）
    location ~ ^/api/(sync|diagnose) {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;

        # 保持你现有的长超时设置
        proxy_connect_timeout 3600;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;

        # 关键配置：处理长连接和流式响应
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;

        # 支持 SSE/流式响应（重要！）
        proxy_set_header X-Accel-Buffering no;

        # 标准代理头部
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        chunked_transfer_encoding on;
    }

    # 默认 location（保持你现有的配置）
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
        proxy_connect_timeout 3600;  # 添加这行

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        chunked_transfer_encoding on;
    }

    # SSL 配置保持不变
    listen 443 ssl;
    ssl_certificate /etc/nginx/ssl/recruiter-agent.duliday.com.pem;
    ssl_certificate_key /etc/nginx/ssl/recruiter-agent.duliday.com.key;
}
```

### 关键改进点

1. **添加 `proxy_connect_timeout 3600`** - 确保连接建立阶段也有足够的超时时间
2. **特殊的 API location 块** - 为同步接口设置专门的配置
3. **`X-Accel-Buffering no`** - 禁用 Nginx 内部缓冲，支持流式响应
4. **keepalive 设置** - 优化连接复用

## 应用更改

1. 编辑 Nginx 配置文件：

   ```bash
   sudo nano /etc/nginx/sites-available/your-site
   ```

2. 测试配置是否正确：

   ```bash
   sudo nginx -t
   ```

3. 重新加载 Nginx：
   ```bash
   sudo systemctl reload nginx
   ```

## 系统级优化

在 VPS 上，你可能还需要调整系统级的网络参数：

1. 编辑 sysctl 配置：

   ```bash
   sudo nano /etc/sysctl.conf
   ```

2. 添加以下配置：

   ```bash
   # 增加 TCP keepalive 时间
   net.ipv4.tcp_keepalive_time = 600
   net.ipv4.tcp_keepalive_intvl = 60
   net.ipv4.tcp_keepalive_probes = 20

   # 增加连接队列
   net.core.somaxconn = 1024
   net.ipv4.tcp_max_syn_backlog = 1024

   # 优化 TCP 性能
   net.ipv4.tcp_fin_timeout = 30
   net.ipv4.tcp_tw_reuse = 1
   ```

3. 应用更改：
   ```bash
   sudo sysctl -p
   ```

## Docker 网络优化

如果使用 Docker，可以在 `docker-compose.prod.yml` 中添加网络配置：

```yaml
services:
  app:
    # ... 其他配置 ...
    sysctls:
      - net.core.somaxconn=1024
      - net.ipv4.tcp_keepalive_time=600
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
```

## 监控和调试

1. 查看 Nginx 错误日志：

   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

2. 查看应用日志：

   ```bash
   docker logs -f ai-computer-use
   ```

3. 监控网络连接：
   ```bash
   netstat -an | grep ESTABLISHED | wc -l
   ```

## 代码端改进

应用代码已经更新，添加了：

1. **超时控制**：30秒的请求超时
2. **自动重试**：最多重试3次，逐渐增加延迟
3. **Keep-Alive 头部**：保持连接活跃
4. **错误处理**：特定处理 ECONNRESET 错误

## 其他可能的原因

1. **防火墙限制**：检查 VPS 防火墙是否限制了出站连接
2. **DNS 解析**：确保 VPS 能正确解析 `k8s.duliday.com`
3. **网络质量**：VPS 到 Duliday API 服务器的网络质量可能较差

## 测试连接

在 VPS 上测试到 Duliday API 的连接：

```bash
# 测试 DNS 解析
nslookup k8s.duliday.com

# 测试连接
curl -I https://k8s.duliday.com

# 测试延迟
ping k8s.duliday.com
```

如果问题持续，可以考虑：

1. 使用 HTTP 代理服务
2. 部署到地理位置更近的 VPS
3. 联系 Duliday API 支持团队了解是否有 IP 限制
