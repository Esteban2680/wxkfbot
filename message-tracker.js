/**
 * 消息处理状态跟踪器
 * 使用 Cloudflare KV 存储已处理的消息ID，避免重复处理
 */

export class MessageTracker {
    constructor(kv, options = {}) {
        this.kv = kv;
        this.expirationTtl = options.expirationTtl || 86400; // 24小时过期
        this.keyPrefix = options.keyPrefix || 'processed_msg';
    }

    /**
     * 生成消息处理状态的 KV 键
     */
    getMessageKey(msgId) {
        return `${this.keyPrefix}:${msgId}`;
    }

    /**
     * 检查消息是否已处理
     */
    async isMessageProcessed(msgId) {
        try {
            const key = this.getMessageKey(msgId);
            const result = await this.kv.get(key);
            return result !== null;
        } catch (error) {
            console.error('检查消息处理状态失败:', error);
            // 出错时返回 false，允许处理消息（安全策略）
            return false;
        }
    }

    /**
     * 标记消息为已处理
     */
    async markMessageAsProcessed(msgId, metadata = {}) {
        try {
            const key = this.getMessageKey(msgId);
            const data = {
                msgId,
                processedAt: new Date().toISOString(),
                timestamp: Date.now(),
                ...metadata,
            };

            await this.kv.put(key, JSON.stringify(data), {
                expirationTtl: this.expirationTtl,
            });

            return true;
        } catch (error) {
            console.error('标记消息处理状态失败:', error);
            throw error;
        }
    }

    /**
     * 获取消息处理信息
     */
    async getMessageProcessInfo(msgId) {
        try {
            const key = this.getMessageKey(msgId);
            const result = await this.kv.get(key);

            if (!result) {
                return null;
            }

            return JSON.parse(result);
        } catch (error) {
            console.error('获取消息处理信息失败:', error);
            return null;
        }
    }

    /**
     * 批量检查消息处理状态
     */
    async checkMultipleMessages(msgIds) {
        const results = {};

        try {
            // 并发检查多个消息状态
            const promises = msgIds.map(async msgId => {
                const processed = await this.isMessageProcessed(msgId);
                return { msgId, processed };
            });

            const checkResults = await Promise.all(promises);

            checkResults.forEach(({ msgId, processed }) => {
                results[msgId] = processed;
            });

            return results;
        } catch (error) {
            console.error('批量检查消息状态失败:', error);
            // 返回所有消息都未处理的结果（安全策略）
            msgIds.forEach(msgId => {
                results[msgId] = false;
            });
            return results;
        }
    }

    /**
     * 删除消息处理记录
     */
    async removeMessageRecord(msgId) {
        try {
            const key = this.getMessageKey(msgId);
            await this.kv.delete(key);
            console.log(`消息 ${msgId} 的处理记录已删除`);
        } catch (error) {
            console.error('删除消息处理记录失败:', error);
            throw error;
        }
    }

    /**
     * 清理过期的消息处理记录
     * 注意：KV 会自动处理过期，这个方法主要用于手动清理
     */
    async cleanupExpiredRecords() {
        try {
            // 由于 KV 的限制，我们无法直接列出所有键
            // KV 会自动清理过期的记录
            console.log('KV 会自动清理过期的消息处理记录');
        } catch (error) {
            console.error('清理过期记录失败:', error);
        }
    }

    /**
     * 获取处理统计信息
     * 由于 KV 限制，只能提供基本信息
     */
    getProcessingStats() {
        return {
            keyPrefix: this.keyPrefix,
            expirationTtl: this.expirationTtl,
            autoExpiry: true,
            note: 'KV存储会自动清理过期记录',
        };
    }
}
