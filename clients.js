/**
 * 微信客户端和OpenAI客户端
 * Cloudflare Worker 版本
 */

/**
 * 微信智能对话客户端
 */
export class WeChatClient {
    constructor(corpid, corpsecret, account = null) {
        this.corpid = corpid;
        this.corpsecret = corpsecret;
        this.account = account;
        this.baseUrl = 'https://qyapi.weixin.qq.com/cgi-bin';
        this.accessToken = null;
        this.tokenExpiresAt = 0;
        this.timeout = 30000;
    }

    // media type
    mediaType = {
        image: 'image',
        voice: 'voice',
        video: 'video',
        file: 'file',
    };

    /**
     * 获取访问令牌
     */
    async getAccessToken() {
        // 如果token未过期，直接返回
        if (this.accessToken && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }

        const url = `${this.baseUrl}/gettoken?corpid=${this.corpid}&corpsecret=${this.corpsecret}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                signal: AbortSignal.timeout(this.timeout),
            });

            if (!response.ok) {
                throw new Error(`获取access_token失败: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.errcode !== 0) {
                throw new Error(`获取access_token失败: ${JSON.stringify(result)}`);
            }

            this.accessToken = result.access_token;
            this.tokenExpiresAt = Date.now() + 7200 * 1000; // token有效期2小时

            return this.accessToken;
        } catch (error) {
            console.error('请求失败:', error);
            throw new Error(`网络请求失败: ${error.message}`);
        }
    }

    /**
     * 发送文本消息
     */
    async sendTextMessage(touser, openKfid, content) {
        if (!this.accessToken) {
            await this.getAccessToken();
        }

        const url = `${this.baseUrl}/kf/send_msg?access_token=${this.accessToken}`;
        const data = {
            touser,
            open_kfid: openKfid,
            msgtype: 'text',
            text: { content },
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(this.timeout),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`发送文本消息失败: ${errorText}`);
            }

            const result = await response.json();
            if (result.errcode !== 0) {
                throw new Error(`发送文本消息失败: ${JSON.stringify(result)}`);
            }

            return result;
        } catch (error) {
            console.error('发送消息失败:', error);
            throw error;
        }
    }

    /**
     * 同步消息
     */
    async syncMessages(msgToken, kfId, nextCursor = null) {
        if (!this.accessToken) {
            await this.getAccessToken();
        }

        const url = `${this.baseUrl}/kf/sync_msg?access_token=${this.accessToken}`;
        const data = {
            token: msgToken,
            open_kfid: kfId,
            limit: 100,
            voice_format: 0,
            cursor: nextCursor,
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(this.timeout),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`同步消息请求失败: HTTP ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            if (result.errcode !== 0) {
                throw new Error(`同步消息失败: ${JSON.stringify(result)}`);
            }

            return result;
        } catch (error) {
            console.error('同步消息失败:', error);
            throw error;
        }
    }

    /**
     * 同步所有消息
     */
    async syncAllMessages(msgToken, kfId) {
        const allMessages = [];
        let cursor = null;

        while (true) {
            const messages = await this.syncMessages(msgToken, kfId, cursor);
            const msgList = messages.msg_list || [];
            allMessages.push(...msgList);

            cursor = messages.next_cursor;
            if (!cursor || msgList.length === 0) {
                break;
            }
        }

        return allMessages;
    }

    /**
     * 获取最新的文本消息
     * @param {string} msgToken 消息token
     * @param {string} kfId 客服ID
     * @param {MessageTracker} messageTracker 消息跟踪器
     * @returns {Array} 未处理的文本消息列表
     */
    async getLatestTextMessages(msgToken, kfId, messageTracker = null) {
        try {
            // 同步所有消息
            const allMessages = await this.syncAllMessages(msgToken, kfId);

            // 按发送时间倒序排序
            allMessages.sort((a, b) => (b.send_time || 0) - (a.send_time || 0));

            // 筛选未处理的文本消息
            const unprocessedTextMessages = [];

            for (const message of allMessages) {
                if (message.msgtype === 'text') {
                    const sendTime = new Date(parseInt(message.send_time) * 1000).toLocaleString('zh-CN');
                    const content = message.text?.content || '';
                    const msgid = message.msgid || '';
                    const externalUserid = message.external_userid || '';

                    if (content && msgid) {
                        // 检查消息是否已处理
                        let isProcessed = false;
                        if (messageTracker) {
                            isProcessed = await messageTracker.isMessageProcessed(msgid);
                        }

                        if (!isProcessed) {
                            unprocessedTextMessages.push({
                                content,
                                msgid,
                                externalUserid,
                                sendTime,
                                originalMessage: message,
                            });
                        }
                    }
                }
                // 只处理最新一条消息
                break;
            }

            return unprocessedTextMessages;
        } catch (error) {
            console.error('获取最新文本消息失败:', error);
            throw error;
        }
    }

    /**
     * 发送图片消息
     */
    async sendImageMessage(touser, openKfid, mediaId) {
        if (!this.accessToken) {
            await this.getAccessToken();
        }

        const url = `${this.baseUrl}/kf/send_msg?access_token=${this.accessToken}`;
        const data = {
            touser,
            open_kfid: openKfid,
            msgtype: 'image',
            image: { media_id: mediaId },
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(this.timeout),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`发送图片消息失败: ${errorText}`);
            }

            const result = await response.json();
            if (result.errcode !== 0) {
                throw new Error(`发送图片消息失败: ${JSON.stringify(result)}`);
            }

            return result;
        } catch (error) {
            console.error('发送图片消息失败:', error);
            throw error;
        }
    }

    /**
     * 发送链接消息
     */
    async sendLinkMessage(touser, openKfid, title, desc, url, thumbMediaId) {
        if (!this.accessToken) {
            await this.getAccessToken();
        }

        const apiUrl = `${this.baseUrl}/kf/send_msg?access_token=${this.accessToken}`;
        const data = {
            touser,
            open_kfid: openKfid,
            msgtype: 'link',
            link: {
                title,
                desc,
                url,
                thumb_media_id: thumbMediaId,
            },
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(this.timeout),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`发送链接消息失败: ${errorText}`);
            }

            const result = await response.json();
            if (result.errcode !== 0) {
                throw new Error(`发送链接消息失败: ${JSON.stringify(result)}`);
            }

            return result;
        } catch (error) {
            console.error('发送链接消息失败:', error);
            throw error;
        }
    }

    /**
     * 获取客服账号列表
     */
    async getKfAccountList() {
        if (!this.accessToken) {
            await this.getAccessToken();
        }

        const url = `${this.baseUrl}/kf/account/list?access_token=${this.accessToken}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                signal: AbortSignal.timeout(this.timeout),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`获取客服账号列表失败: ${errorText}`);
            }

            const result = await response.json();
            if (result.errcode !== 0) {
                throw new Error(`获取客服账号列表失败: ${JSON.stringify(result)}`);
            }

            return result;
        } catch (error) {
            console.error('获取客服账号列表失败:', error);
            throw error;
        }
    }

    /**
     * 获取会话状态
     */
    async getServiceState(openKfid, externalUserid) {
        if (!this.accessToken) {
            await this.getAccessToken();
        }

        const url = `${this.baseUrl}/kf/service_state/get?access_token=${this.accessToken}`;
        const data = {
            open_kfid: openKfid,
            external_userid: externalUserid,
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(this.timeout),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`获取会话状态失败: ${errorText}`);
            }

            const result = await response.json();
            if (result.errcode !== 0) {
                throw new Error(`获取会话状态失败: ${JSON.stringify(result)}`);
            }

            return result;
        } catch (error) {
            console.error('获取会话状态失败:', error);
            throw error;
        }
    }

    /**
     * 发送文件消息
     */
    async sendFileMessage(touser, openKfid, mediaId) {
        if (!this.accessToken) {
            await this.getAccessToken();
        }

        const url = `${this.baseUrl}/kf/send_msg?access_token=${this.accessToken}`;
        const data = {
            touser,
            open_kfid: openKfid,
            msgtype: 'file',
            file: { media_id: mediaId },
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(this.timeout),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`发送文件消息失败: ${errorText}`);
            }

            const result = await response.json();
            if (result.errcode !== 0) {
                throw new Error(`发送文件消息失败: ${JSON.stringify(result)}`);
            }

            return result;
        } catch (error) {
            console.error('发送文件消息失败:', error);
            throw error;
        }
    }

    /**
     * 上传临时素材
     */
    async uploadMedia(mediaType, file, filename) {
        if (!this.accessToken) {
            await this.getAccessToken();
        }

        const url = `${this.baseUrl}/media/upload?access_token=${this.accessToken}&type=${mediaType}`;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('filename', filename);

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`上传临时素材失败: ${errorText}`);
            }

            const result = await response.json();
            if (result.errcode !== 0) {
                throw new Error(`上传临时素材失败: ${JSON.stringify(result)}`);
            }

            return result;
        } catch (error) {
            console.error('上传临时素材失败:', error);
            throw error;
        }
    }
}

/**
 * OpenAI API 客户端
 * 支持 OpenAI 官方 API 服务
 */
export class OpenAIClient {
    constructor(config = {}) {
        // 从配置对象或环境变量获取配置
        this.apiKey = config.apiKey || config.sk;
        this.baseUrl = (config.baseUrl || config.baseURL || 'https://api.openai.com').replace(/\/$/, '');
        this.defaultModel = config.model || config.defaultModel || 'gpt-3.5-turbo';
        this.timeout = config.timeout || 30000;
        this.organization = config.organization;
        this.project = config.project;

        if (!this.apiKey) {
            throw new Error('API Key is required');
        }
    }

    /**
     * 从环境变量创建客户端实例
     */
    static fromEnv(env) {
        return new OpenAIClient({
            apiKey: env.OPENAI_API_KEY,
            baseUrl: env.OPENAI_BASE_URL || 'https://api.openai.com',
            model: env.OPENAI_MODEL || 'gpt-3.5-turbo',
            timeout: env.OPENAI_TIMEOUT ? parseInt(env.OPENAI_TIMEOUT) : 30000,
            organization: env.OPENAI_ORGANIZATION,
            project: env.OPENAI_PROJECT,
        });
    }

    /**
     * 获取请求头
     */
    getHeaders() {
        const headers = {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'OpenAI-Compatible-Client/1.0',
        };

        if (this.organization) {
            headers['OpenAI-Organization'] = this.organization;
        }

        if (this.project) {
            headers['OpenAI-Project'] = this.project;
        }

        return headers;
    }

    /**
     * 聊天完成 API
     * 兼容 OpenAI Chat Completions API
     */
    async chatCompletion(options = {}) {
        const {
            messages,
            model = this.defaultModel,
            temperature = 0.7,
            max_tokens,
            top_p,
            frequency_penalty,
            presence_penalty,
            stop,
            stream = false,
            ...otherOptions
        } = options;

        if (!messages || !Array.isArray(messages)) {
            throw new Error('messages is required and must be an array');
        }

        const url = `${this.baseUrl}/v1/chat/completions`;
        const data = {
            model,
            messages,
            temperature,
            ...(max_tokens && { max_tokens }),
            ...(top_p && { top_p }),
            ...(frequency_penalty && { frequency_penalty }),
            ...(presence_penalty && { presence_penalty }),
            ...(stop && { stop }),
            stream,
            ...otherOptions,
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(this.timeout),
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error?.message || errorText;
                } catch {
                    errorMessage = errorText;
                }
                throw new Error(`API请求失败: HTTP ${response.status} - ${errorMessage}`);
            }

            return await response.json();
        } catch (error) {
            console.error('OpenAI兼容API请求失败:', error);
            throw new Error(`网络请求失败: ${error.message}`);
        }
    }

    /**
     * 流式聊天完成
     */
    async *chatCompletionStream(options = {}) {
        const streamOptions = { ...options, stream: true };

        const url = `${this.baseUrl}/v1/chat/completions`;
        const data = {
            model: options.model || this.defaultModel,
            messages: options.messages,
            temperature: options.temperature || 0.7,
            stream: true,
            ...streamOptions,
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(this.timeout),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`流式请求失败: HTTP ${response.status} - ${errorText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n').filter(line => line.trim());

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') return;

                            try {
                                const parsed = JSON.parse(data);
                                yield parsed;
                            } catch (e) {
                                console.warn('解析流数据失败:', e);
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } catch (error) {
            console.error('流式请求失败:', error);
            throw error;
        }
    }

    /**
     * 获取模型列表
     */
    async listModels() {
        const url = `${this.baseUrl}/v1/models`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(this.timeout),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`获取模型列表失败: HTTP ${response.status} - ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('获取模型列表失败:', error);
            throw error;
        }
    }
}
