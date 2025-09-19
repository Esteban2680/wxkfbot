/**
 * 微信客服 Cloudflare Worker 版本
 * 处理微信企业客服回调消息并与AI客服集成
 */
import { OpenAIClient, WeChatClient } from './clients.js';
import { getAIConfig, getServiceStatus, validateAIConfig } from './config.js';
import { ConversationManager } from './conversation.js';
import { WXBizMsgCrypt, XMLParse } from './crypto.js';
import { MessageTracker } from './message-tracker.js';
import { ApiResponse, BusinessCode, ErrorMessage } from './response.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        try {
            // 处理 OPTIONS 预检请求
            if (request.method === 'OPTIONS') {
                return ApiResponse.options();
            }

            // 路由处理
            if (url.pathname === '/get_access_token' && request.method === 'GET') {
                return handleGetAccessToken(env, ctx);
            }

            if (url.pathname === '/ai_status' && request.method === 'GET') {
                return handleAIStatus(env, ctx);
            }

            if (url.pathname === '/conversation_stats' && request.method === 'GET') {
                return handleConversationStats(env, ctx);
            }

            if (url.pathname === '/clear_conversation' && request.method === 'POST') {
                return handleClearConversation(request, env, ctx);
            }

            if (url.pathname === '/message_status' && request.method === 'GET') {
                return handleMessageStatus(request, env, ctx);
            }

            if (url.pathname === '/clear_message_records' && request.method === 'POST') {
                return handleClearMessageRecords(request, env, ctx);
            }

            if (url.pathname === '/test_crypto' && request.method === 'GET') {
                return handleTestCrypto(env, ctx);
            }

            if (url.pathname === '/upload_media' && request.method === 'POST') {
                return handleUploadMedia(request, env, ctx);
            }

            if (url.pathname === '/callback') {
                if (request.method === 'GET') {
                    return handleVerifyCallback(request, env, ctx);
                } else if (request.method === 'POST') {
                    return handleCallback(request, env, ctx);
                }
            }

            return ApiResponse.notFound('API端点未找到');
        } catch (error) {
            console.error('处理请求失败:', error);
            return ApiResponse.internalError('服务器内部错误', {
                error: error.message,
                stack: error.stack,
            });
        }
    },
};

/**
 * 获取微信访问令牌
 */
async function handleGetAccessToken(env, ctx) {
    try {
        if (!env.WECHAT_CORP_ID || !env.WECHAT_KF_SECRET) {
            return ApiResponse.badRequest(ErrorMessage.WECHAT_CONFIG_MISSING, {
                missing: ['WECHAT_CORP_ID', 'WECHAT_KF_SECRET'].filter(key => !env[key]),
            });
        }

        const wxClient = new WeChatClient(env.WECHAT_CORP_ID, env.WECHAT_KF_SECRET);
        const accessToken = await wxClient.getAccessToken();

        return ApiResponse.success(
            {
                access_token: accessToken,
                expires_in: 7200,
            },
            '访问令牌获取成功',
        );
    } catch (error) {
        console.error('获取access_token失败:', error);
        return ApiResponse.error(ErrorMessage.WECHAT_API_FAILED, BusinessCode.WECHAT_API_ERROR, 500, {
            error: error.message,
        });
    }
}

/**
 * 获取 AI 服务状态
 */
async function handleAIStatus(env, ctx) {
    try {
        const aiConfig = getAIConfig(env);
        validateAIConfig(aiConfig);
        const status = getServiceStatus(aiConfig);

        return ApiResponse.success(status, 'AI服务状态获取成功');
    } catch (error) {
        console.error('获取AI状态失败:', error);
        return ApiResponse.error(ErrorMessage.OPENAI_CONFIG_MISSING, BusinessCode.OPENAI_CONFIG_ERROR, 500, {
            error: error.message,
        });
    }
}

/**
 * 获取对话统计信息
 */
async function handleConversationStats(env, ctx) {
    try {
        if (!env.CONVERSATIONS) {
            return ApiResponse.badRequest(ErrorMessage.KV_CONFIG_MISSING, {
                missing: ['CONVERSATIONS'],
            });
        }

        // 返回系统级统计信息
        return ApiResponse.success(
            {
                kvNamespace: 'CONVERSATIONS',
                note: 'KV存储的对话历史，请使用 POST /conversation_stats 并传递 user_id 获取特定用户统计',
            },
            '对话统计信息获取成功',
        );
    } catch (error) {
        console.error('获取对话统计失败:', error);
        return ApiResponse.error(ErrorMessage.KV_OPERATION_FAILED, BusinessCode.KV_OPERATION_ERROR, 500, {
            error: error.message,
        });
    }
}

/**
 * 清除用户对话历史
 */
async function handleClearConversation(request, env, ctx) {
    try {
        const body = await request.json();
        const userId = body.user_id;

        if (!userId) {
            return ApiResponse.badRequest(ErrorMessage.MISSING_PARAMETER, {
                required: ['user_id'],
            });
        }

        if (!env.CONVERSATIONS) {
            return ApiResponse.badRequest(ErrorMessage.KV_CONFIG_MISSING, {
                missing: ['CONVERSATIONS'],
            });
        }

        const conversationManager = new ConversationManager(env.CONVERSATIONS);
        await conversationManager.clearConversationHistory(userId);

        return ApiResponse.success(
            {
                userId,
                cleared: true,
            },
            `用户 ${userId} 的对话历史已清除`,
        );
    } catch (error) {
        console.error('清除对话历史失败:', error);
        return ApiResponse.error(ErrorMessage.KV_OPERATION_FAILED, BusinessCode.KV_OPERATION_ERROR, 500, {
            error: error.message,
        });
    }
}

/**
 * 获取消息处理状态
 */
async function handleMessageStatus(request, env, ctx) {
    try {
        const url = new URL(request.url);
        const msgId = url.searchParams.get('msg_id');

        if (!msgId) {
            return ApiResponse.badRequest(ErrorMessage.MISSING_PARAMETER, {
                required: ['msg_id'],
            });
        }

        if (!env.MESSAGE_TRACKER) {
            return ApiResponse.badRequest(ErrorMessage.KV_CONFIG_MISSING, {
                missing: ['MESSAGE_TRACKER'],
            });
        }

        const messageTracker = new MessageTracker(env.MESSAGE_TRACKER);
        const processInfo = await messageTracker.getMessageProcessInfo(msgId);

        if (processInfo) {
            return ApiResponse.success(
                {
                    msgId,
                    processed: true,
                    ...processInfo,
                },
                '消息处理状态获取成功',
            );
        } else {
            return ApiResponse.success(
                {
                    msgId,
                    processed: false,
                },
                '消息未处理',
            );
        }
    } catch (error) {
        console.error('获取消息状态失败:', error);
        return new Response(
            JSON.stringify({
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString(),
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            },
        );
    }
}

/**
 * 清除消息处理记录
 */
async function handleClearMessageRecords(request, env, ctx) {
    try {
        const body = await request.json();
        const msgIds = body.msg_ids;

        if (!msgIds || !Array.isArray(msgIds)) {
            return new Response(
                JSON.stringify({
                    status: 'error',
                    error: 'msg_ids array is required',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        }

        if (!env.MESSAGE_TRACKER) {
            throw new Error('MESSAGE_TRACKER KV namespace not configured');
        }

        const messageTracker = new MessageTracker(env.MESSAGE_TRACKER);

        // 并发删除多个消息记录
        const deletePromises = msgIds.map(msgId => messageTracker.removeMessageRecord(msgId));

        await Promise.all(deletePromises);

        return new Response(
            JSON.stringify({
                status: 'ok',
                message: `已清除 ${msgIds.length} 条消息处理记录`,
                clearedMsgIds: msgIds,
                timestamp: new Date().toISOString(),
            }),
            {
                headers: { 'Content-Type': 'application/json' },
            },
        );
    } catch (error) {
        console.error('清除消息记录失败:', error);
        return new Response(
            JSON.stringify({
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString(),
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            },
        );
    }
}

/**
 * 上传临时素材
 */
async function handleUploadMedia(request, env, ctx) {
    try {
        const form = await request.formData();
        const mediaType = form.get('media_type');
        const file = form.get('file');
        const filename = form.get('filename');

        const wxClient = new WeChatClient(env.WECHAT_CORP_ID, env.WECHAT_KF_SECRET);
        const result = await wxClient.uploadMedia(mediaType, file, filename);

        return ApiResponse.success(result, '上传临时素材成功');
    } catch (error) {
        console.error('上传临时素材失败:', error);
        return ApiResponse.error(ErrorMessage.WECHAT_API_FAILED, BusinessCode.WECHAT_API_ERROR, 500, {
            error: error.message,
        });
    }
}

/**
 * 测试加解密功能
 */
async function handleTestCrypto(env, ctx) {
    try {
        // 检查必要的环境变量
        if (!env.WECHAT_KF_TOKEN || !env.WECHAT_KF_ENCODING_AES_KEY || !env.WECHAT_CORP_ID) {
            return new Response(
                JSON.stringify({
                    status: 'error',
                    error: '缺少必要的微信配置：WECHAT_KF_TOKEN, WECHAT_KF_ENCODING_AES_KEY, WECHAT_CORP_ID',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        }

        // 创建加解密实例
        const wxcrypt = new WXBizMsgCrypt(env.WECHAT_KF_TOKEN, env.WECHAT_KF_ENCODING_AES_KEY, env.WECHAT_CORP_ID);

        // 执行测试
        const testResult = await wxcrypt.testCrypto();

        return new Response(
            JSON.stringify({
                status: 'ok',
                ...testResult,
                config: {
                    token: env.WECHAT_KF_TOKEN ? '已配置' : '未配置',
                    encodingAESKey: env.WECHAT_KF_ENCODING_AES_KEY
                        ? `已配置(${env.WECHAT_KF_ENCODING_AES_KEY.length}位)`
                        : '未配置',
                    corpId: env.WECHAT_CORP_ID ? '已配置' : '未配置',
                },
                timestamp: new Date().toISOString(),
            }),
            {
                headers: { 'Content-Type': 'application/json' },
            },
        );
    } catch (error) {
        console.error('测试加解密失败:', error);
        return new Response(
            JSON.stringify({
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString(),
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            },
        );
    }
}

/**
 * 验证回调配置
 */
async function handleVerifyCallback(request, env, ctx) {
    const url = new URL(request.url);
    const msgSignature = url.searchParams.get('msg_signature');
    const timestamp = url.searchParams.get('timestamp');
    const nonce = url.searchParams.get('nonce');
    const echostr = url.searchParams.get('echostr');

    // 验证必要参数
    if (!msgSignature || !timestamp || !nonce || !echostr) {
        return ApiResponse.text('缺少必要参数', 400);
    }

    try {
        // 使用WXBizMsgCrypt解密echostr
        const wxcrypt = new WXBizMsgCrypt(env.WECHAT_KF_TOKEN, env.WECHAT_KF_ENCODING_AES_KEY, env.WECHAT_CORP_ID);

        const res = await wxcrypt.verifyURL(msgSignature, timestamp, nonce, echostr);
        const { ret, decryptedEchostr } = res;

        console.log('res:', res);

        if (ret !== 0) {
            console.error(`验证失败，错误码: ${ret}`);
            return ApiResponse.error(ret, ret, 400, res.details);
        }

        console.log(`解密后的echostr: ${decryptedEchostr}`);
        return ApiResponse.text(decryptedEchostr);
    } catch (error) {
        console.error('处理失败:', error);
        return ApiResponse.error(`处理失败: ${error.message}`, 400);
    }
}

/**
 * 处理回调消息
 */
async function handleCallback(request, env, ctx) {
    const url = new URL(request.url);
    const params = {
        msgSignature: url.searchParams.get('msg_signature'),
        timestamp: url.searchParams.get('timestamp'),
        nonce: url.searchParams.get('nonce'),
    };

    // 验证必要参数
    if (!params.msgSignature || !params.timestamp || !params.nonce) {
        return ApiResponse.text('缺少必要参数', 400);
    }

    // 预先读取请求内容
    const postData = await request.text();
    if (!postData) {
        return ApiResponse.text('请求体为空', 400);
    }

    // 异步处理消息
    ctx.waitUntil(handleCallbackAsync(postData, env, params));

    // 立即返回成功响应，否则微信会重试，导致多次处理
    return ApiResponse.text('success');
}

/**
 * 异步处理回调消息
 */
async function handleCallbackAsync(postData, env, params) {
    const messageTracker = new MessageTracker(env.MESSAGE_TRACKER);

    try {
        // 使用WXBizMsgCrypt解密消息
        const wxcrypt = new WXBizMsgCrypt(env.WECHAT_KF_TOKEN, env.WECHAT_KF_ENCODING_AES_KEY, env.WECHAT_CORP_ID);

        const { ret, decryptedXml } = await wxcrypt.decryptMsg(
            postData,
            params.msgSignature,
            params.timestamp,
            params.nonce,
        );

        if (ret !== 0) {
            console.error('签名验证失败:', ret);
            return;
        }

        // 解析XML消息
        const xmlParse = new XMLParse();
        const { xml } = xmlParse.parseXML(decryptedXml);
        const msgInfo = {
            token: xml.Token || '',
            kfId: xml.OpenKfId || '',
        };

        // 创建微信客户端
        const wxClient = new WeChatClient(env.WECHAT_CORP_ID, env.WECHAT_KF_SECRET);

        // 获取最新的未处理文本消息
        const unprocessedMessages = await wxClient.getLatestTextMessages(msgInfo.token, msgInfo.kfId, messageTracker);

        // 处理最新的一条消息
        if (unprocessedMessages.length > 0) {
            const [latestMessage] = unprocessedMessages;
            await processUserMessage(
                latestMessage.externalUserid,
                latestMessage.content,
                latestMessage.msgid,
                msgInfo.kfId,
                wxClient,
                env,
            );
        }

        // 标记回调请求为已处理
        await messageTracker.markMessageAsProcessed(params.msgSignature, {
            timestamp: params.timestamp,
            nonce: params.nonce,
            success: true,
        });
    } catch (error) {
        console.error('处理回调消息失败:', error);
        // 标记为处理失败
        await messageTracker.markMessageAsProcessed(params.msgSignature, {
            timestamp: params.timestamp,
            nonce: params.nonce,
            error: error.message,
            success: false,
        });
    }
}

/**
 * 处理用户消息
 */
async function processUserMessage(externalUserid, content, msgid, msgKfId, wxClient, env) {
    // 检查 KV 存储是否配置
    if (!env.CONVERSATIONS || !env.MESSAGE_TRACKER) {
        throw new Error('CONVERSATIONS or MESSAGE_TRACKER KV namespace not configured');
    }

    const messageTracker = new MessageTracker(env.MESSAGE_TRACKER);
    const isProcessed = await messageTracker.isMessageProcessed(msgid);

    if (isProcessed) {
        console.log(`消息 ${msgid} 已处理，跳过`);
        return;
    }

    try {
        // 创建对话管理器
        const conversationManager = new ConversationManager(env.CONVERSATIONS, {
            maxHistoryLength: 10,
            expirationTtl: 86400, // 24小时
            systemPrompt: env.SYSTEM_PROMPT || 'you are helpful assistant',
        });

        // 处理用户消息并获取对话历史
        const { aiMessages } = await conversationManager.processUserMessage(externalUserid, content);

        // 调用AI客服
        const aiConfig = getAIConfig(env);
        validateAIConfig(aiConfig);
        const aiClient = new OpenAIClient(aiConfig);

        // 获取AI响应
        const response = await aiClient.chatCompletion({ messages: aiMessages });

        console.log('Assistant Response:\n', JSON.stringify(response, null, 2));

        const assistantMessage = response.choices?.[0]?.message?.content;

        if (!assistantMessage) {
            throw new Error('AI 返回空回复');
        }

        // 保存助手回复到对话历史
        await conversationManager.completeAssistantReply(externalUserid, assistantMessage);

        const messageChunkSize = 1024;
        const messageChunkCount = 5;
        if (assistantMessage.length > messageChunkSize) {
            const messageChunks = splitStringByLength(assistantMessage.trim(), messageChunkSize);
            for (let i = 0; i < messageChunks.length; i++) {
                const chunk = messageChunks[i];
                if (i + 1 === messageChunkCount || i === messageChunks.length - 1) {
                    await wireNote(externalUserid, msgKfId, msgid, content, assistantMessage, env);
                } else {
                    await wxClient.sendTextMessage(externalUserid, msgKfId, chunk);
                }
            }
        } else {
            await wxClient.sendTextMessage(externalUserid, msgKfId, assistantMessage);
        }

        // 标记消息为已处理
        await messageTracker.markMessageAsProcessed(msgid, {
            externalUserid,
            content,
            assistantMessage,
            success: true,
        });
    } catch (error) {
        console.error('AI处理失败:', error);

        // 发送错误提示给用户
        const errorMessage = '抱歉，AI服务暂时不可用，请稍后再试。';
        try {
            await wxClient.sendTextMessage(externalUserid, msgKfId, errorMessage);
        } catch (sendError) {
            console.error('发送错误消息失败:', sendError);
        }

        // 标记消息为已处理（即使失败也要标记，避免重复处理）
        await messageTracker.markMessageAsProcessed(msgid, {
            externalUserid,
            content,
            error: error.message,
            success: false,
        });
    }
}

/**
 * 按长度分割字符串
 */
function splitStringByLength(str, len) {
    const result = [];
    let index = 0;
    while (index < str.length) {
        // 从当前 index 开始，提取 len 长度的子串
        // index += len 移动到下一个子串的起始位置
        result.push(str.slice(index, (index += len)));
    }
    return result;
}

async function wireNote(externalUserid, msgKfId, msgid, question, value, env) {
    const wxClient = new WeChatClient(env.WECHAT_CORP_ID, env.WECHAT_KF_SECRET);

    const blob = new Blob([value], { type: 'text/plain' });
    const file = new File([blob], `${question}-完整回答-${msgid}.txt`, { type: 'text/plain' });

    // 传给微信接口
    const { media_id } = await wxClient.uploadMedia(wxClient.mediaType.file, file, `${question}-完整回答-${msgid}.txt`);

    const result = await wxClient.sendFileMessage(externalUserid, msgKfId, media_id);
    return result.msgid;
}
