# 微信客服 AI 助手 (WxKF Bot)

基于 Cloudflare Worker 构建的微信客服 AI 聊天机器人，支持与 OpenAI GPT 模型对话。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/bestk/wxkfbot)

## 功能特点

-   🚀 基于 Cloudflare Worker，无需服务器
-   🤖 集成 OpenAI GPT 模型，支持智能对话
-   💬 支持微信客服消息接收和回复
-   🔐 内置完整的消息加解密功能
-   💾 使用 Cloudflare KV 存储会话历史
-   ⚡ 低延迟，高可用

## 快速开始

### 1. 配置要求

-   Cloudflare 账号
-   微信企业号客服配置
-   OpenAI API 密钥
-   加密服务部署（用于消息加解密）

### 2. 部署步骤

#### 方式一：一键部署（推荐）

点击上方的 "Deploy to Cloudflare Workers" 按钮，按照提示操作：

1. 登录您的 Cloudflare 账号
2. 设置必要的环境变量（见下方环境变量说明）
3. 创建并配置 KV 命名空间
4. 完成部署

#### 方式二：手动部署

1. 克隆项目：

```bash
git clone https://github.com/bestk/wxkfbot.git
cd wxkfbot
```

2. 安装依赖：

```bash
npm install
```

3. 配置环境变量：

    - 复制 `wrangler.toml.example` 为 `wrangler.toml`
    - 填写相关配置项：
        - 微信企业号配置（WECHAT\_\*）
        - OpenAI API 配置（OPENAI\_\*）
        - KV 命名空间配置

4. 创建 Cloudflare KV 命名空间：

```bash
wrangler kv:namespace create "CONVERSATIONS"
wrangler kv:namespace create "MESSAGE_TRACKER"
```

将生成的 ID 填入 `wrangler.toml`

5. 部署到 Cloudflare：

```bash
wrangler deploy
```

### 3. 微信配置

1. 在企业微信管理后台配置接收消息的服务器地址：

    - URL：`https://your-worker.your-subdomain.workers.dev`
    - Token：与 WECHAT_KF_TOKEN 配置一致
    - EncodingAESKey：与 WECHAT_KF_ENCODING_AES_KEY 配置一致

2. 开启客服功能，获取相关配置信息填入 `wrangler.toml`

## 环境变量说明

| 变量名                     | 说明                           | 必填 |
| -------------------------- | ------------------------------ | ---- |
| WECHAT_CORP_ID             | 企业微信 CorpID                | 是   |
| WECHAT_KF_SECRET           | 客服密钥                       | 是   |
| WECHAT_KF_TOKEN            | 消息校验 Token                 | 是   |
| WECHAT_KF_ENCODING_AES_KEY | 消息加解密 Key                 | 是   |
| OPENAI_API_KEY             | OpenAI API 密钥                | 是   |
| OPENAI_BASE_URL            | OpenAI API 地址                | 否   |
| OPENAI_MODEL               | 使用的模型，默认 gpt-3.5-turbo | 否   |
| SYSTEM_PROMPT              | AI 系统提示词                  | 否   |
| CRYPTO_SERVICE_URL         | 加密服务地址                   | 是   |

## 项目结构

```
wxkfbot/
├── clients.js          # API 客户端实现
├── config.js           # 配置管理
├── conversation.js     # 对话管理
├── crypto.js          # 消息加解密
├── index.js           # 主入口
├── message-tracker.js  # 消息跟踪
└── response.js        # 响应处理
```

## 开发说明

-   项目使用 ES 模块规范
-   使用 Cloudflare Worker 运行时环境
-   支持 Node.js 兼容模式
-   使用 KV 存储实现持久化

### 关于加密服务

由于 Cloudflare Worker 的 CRYPTO API 存在兼容性问题，消息加解密功能被拆分为独立的 Deno 服务。您需要：

1. 部署加密服务：

    - 使用项目中的 `wecom_crypto_deno.ts` 文件
    - 可以部署到 Deno Deploy 等平台
    - 获取部署后的服务地址

2. 配置 CRYPTO_SERVICE_URL：
    - 在 `wrangler.toml` 中设置 `CRYPTO_SERVICE_URL` 为加密服务地址
    - 格式如：`https://your-crypto-service.deno.dev`

## 许可证

MIT License

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进项目。

## 联系方式

如有问题，请提交 Issue 或通过以下方式联系：

-   项目地址：[GitHub](https://github.com/bestk/wxkfbot)
