/**
 * 对话历史管理
 * 使用 Cloudflare KV 存储对话历史
 */

/**
 * 对话历史管理器
 */
export class ConversationManager {
    constructor(kv, options = {}) {
        this.kv = kv;
        this.maxHistoryLength = options.maxHistoryLength || 10;
        this.expirationTtl = options.expirationTtl || 86400; // 24小时
        this.systemPrompt = options.systemPrompt || 'you are helpful assistant';
    }

    /**
     * 生成对话历史的 KV 键
     */
    getConversationKey(userId) {
        return `conversation:${userId}`;
    }

    /**
     * 获取用户的对话历史
     */
    async getConversationHistory(userId) {
        try {
            const key = this.getConversationKey(userId);
            const historyJson = await this.kv.get(key);

            let history = [];
            if (historyJson) {
                history = JSON.parse(historyJson);
                // 移除旧的系统提示（如果存在）
                if (history.length > 0 && history[0].role === 'system') {
                    history.shift();
                }
            }

            // 始终添加最新的系统提示
            history.unshift({
                role: 'system',
                content: this.systemPrompt,
            });

            return history;
        } catch (error) {
            console.error('获取对话历史失败:', error);
            // 返回默认历史记录
            return [
                {
                    role: 'system',
                    content: this.systemPrompt,
                },
            ];
        }
    }

    /**
     * 保存用户的对话历史
     */
    async saveConversationHistory(userId, history) {
        try {
            const key = this.getConversationKey(userId);

            // 限制历史记录长度，保留系统消息 + 最近的对话
            let trimmedHistory = [...history];
            if (trimmedHistory.length > this.maxHistoryLength + 1) {
                // +1 for system message
                trimmedHistory = [
                    trimmedHistory[0], // 保留系统消息
                    ...trimmedHistory.slice(-this.maxHistoryLength),
                ];
            }

            const historyJson = JSON.stringify(trimmedHistory);

            // 保存到 KV，设置过期时间
            await this.kv.put(key, historyJson, {
                expirationTtl: this.expirationTtl,
            });

            return trimmedHistory;
        } catch (error) {
            console.error('保存对话历史失败:', error);
            throw error;
        }
    }

    /**
     * 添加用户消息到对话历史
     */
    async addUserMessage(userId, content) {
        const history = await this.getConversationHistory(userId);
        history.push({
            role: 'user',
            content: content,
            timestamp: Date.now(),
        });

        return await this.saveConversationHistory(userId, history);
    }

    /**
     * 添加助手回复到对话历史
     */
    async addAssistantMessage(userId, content) {
        const history = await this.getConversationHistory(userId);
        history.push({
            role: 'assistant',
            content: content,
            timestamp: Date.now(),
        });

        return await this.saveConversationHistory(userId, history);
    }

    /**
     * 清除用户的对话历史
     */
    async clearConversationHistory(userId) {
        try {
            const key = this.getConversationKey(userId);
            await this.kv.delete(key);
            console.log(`对话历史已清除，用户: ${userId}`);
        } catch (error) {
            console.error('清除对话历史失败:', error);
            throw error;
        }
    }

    /**
     * 获取对话统计信息
     */
    async getConversationStats(userId) {
        try {
            const history = await this.getConversationHistory(userId);
            const userMessages = history.filter(msg => msg.role === 'user');
            const assistantMessages = history.filter(msg => msg.role === 'assistant');

            return {
                totalMessages: history.length - 1, // 排除系统消息
                userMessages: userMessages.length,
                assistantMessages: assistantMessages.length,
                lastActivity: history.length > 1 ? history[history.length - 1].timestamp : null,
            };
        } catch (error) {
            console.error('获取对话统计失败:', error);
            return {
                totalMessages: 0,
                userMessages: 0,
                assistantMessages: 0,
                lastActivity: null,
            };
        }
    }

    /**
     * 批量清理过期的对话历史
     * 注意：KV 会自动处理过期，这个方法主要用于手动清理
     */
    async cleanupExpiredConversations() {
        try {
            // 由于 KV 的限制，我们无法直接列出所有键
            // 这个方法主要是为了将来可能的扩展
            console.log('KV 会自动清理过期的对话历史');
        } catch (error) {
            console.error('清理过期对话失败:', error);
        }
    }

    /**
     * 处理完整的对话流程
     * 添加用户消息 -> 获取历史 -> 返回用于AI的消息列表
     */
    async processUserMessage(userId, userMessage) {
        try {
            // 添加用户消息
            const updatedHistory = await this.addUserMessage(userId, userMessage);

            // 返回用于AI的消息列表（不包含timestamp等额外字段）
            const aiMessages = updatedHistory.map(msg => ({
                role: msg.role,
                content: msg.content,
            }));

            return {
                history: updatedHistory,
                aiMessages: aiMessages,
            };
        } catch (error) {
            console.error('处理用户消息失败:', error);
            throw error;
        }
    }

    /**
     * 完成AI回复后的处理
     */
    async completeAssistantReply(userId, assistantMessage) {
        try {
            return await this.addAssistantMessage(userId, assistantMessage);
        } catch (error) {
            console.error('完成助手回复失败:', error);
            throw error;
        }
    }
}
