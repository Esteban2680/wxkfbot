/**
 * 统一响应格式管理
 */

/**
 * 标准响应格式
 */
export class ApiResponse {
    /**
     * 成功响应
     * @param {any} data - 响应数据
     * @param {string} message - 成功消息
     * @param {number} code - 业务状态码，默认200
     */
    static success(data = null, message = 'success', code = 200) {
        const response = {
            success: true,
            code,
            message,
            timestamp: new Date().toISOString(),
            data,
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    /**
     * 错误响应
     * @param {string} message - 错误消息
     * @param {number} code - 业务错误码，默认400
     * @param {number} httpStatus - HTTP状态码，默认400
     * @param {any} details - 错误详情
     */
    static error(message = 'error', code = 400, httpStatus = 400, details = null) {
        const response = {
            success: false,
            code,
            message,
            timestamp: new Date().toISOString(),
            ...(details && { details }),
        };

        return new Response(JSON.stringify(response), {
            status: httpStatus,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    /**
     * 参数错误响应
     * @param {string} message - 错误消息
     * @param {any} details - 错误详情
     */
    static badRequest(message = '请求参数错误', details = null) {
        return ApiResponse.error(message, 400, 400, details);
    }

    /**
     * 未授权响应
     * @param {string} message - 错误消息
     */
    static unauthorized(message = '未授权访问') {
        return ApiResponse.error(message, 401, 401);
    }

    /**
     * 禁止访问响应
     * @param {string} message - 错误消息
     */
    static forbidden(message = '禁止访问') {
        return ApiResponse.error(message, 403, 403);
    }

    /**
     * 资源未找到响应
     * @param {string} message - 错误消息
     */
    static notFound(message = '资源未找到') {
        return ApiResponse.error(message, 404, 404);
    }

    /**
     * 服务器内部错误响应
     * @param {string} message - 错误消息
     * @param {any} details - 错误详情
     */
    static internalError(message = '服务器内部错误', details = null) {
        return ApiResponse.error(message, 500, 500, details);
    }

    /**
     * 服务不可用响应
     * @param {string} message - 错误消息
     */
    static serviceUnavailable(message = '服务暂时不可用') {
        return ApiResponse.error(message, 503, 503);
    }

    /**
     * 纯文本响应（用于微信回调等特殊场景）
     * @param {string} text - 响应文本
     * @param {number} status - HTTP状态码
     */
    static text(text, status = 200) {
        return new Response(text, {
            status,
            headers: {
                'Content-Type': 'text/plain',
            },
        });
    }

    /**
     * OPTIONS 预检请求响应
     */
    static options() {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400',
            },
        });
    }
}

/**
 * 业务状态码定义
 */
export const BusinessCode = {
    // 成功状态码
    SUCCESS: 200,
    CREATED: 201,
    ACCEPTED: 202,

    // 客户端错误状态码
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    VALIDATION_ERROR: 422,

    // 服务器错误状态码
    INTERNAL_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,

    // 业务特定错误码
    WECHAT_CONFIG_ERROR: 1001,
    WECHAT_CRYPTO_ERROR: 1002,
    WECHAT_API_ERROR: 1003,

    OPENAI_CONFIG_ERROR: 2001,
    OPENAI_API_ERROR: 2002,
    OPENAI_QUOTA_ERROR: 2003,

    KV_CONFIG_ERROR: 3001,
    KV_OPERATION_ERROR: 3002,

    MESSAGE_DUPLICATE: 4001,
    MESSAGE_INVALID: 4002,

    CONVERSATION_NOT_FOUND: 5001,
    CONVERSATION_EXPIRED: 5002,
};

/**
 * 错误消息定义
 */
export const ErrorMessage = {
    // 通用错误
    INVALID_REQUEST: '请求格式无效',
    MISSING_PARAMETER: '缺少必要参数',
    INVALID_PARAMETER: '参数格式错误',

    // 微信相关错误
    WECHAT_CONFIG_MISSING: '微信配置缺失',
    WECHAT_SIGNATURE_INVALID: '微信签名验证失败',
    WECHAT_DECRYPT_FAILED: '微信消息解密失败',
    WECHAT_API_FAILED: '微信API调用失败',

    // OpenAI相关错误
    OPENAI_CONFIG_MISSING: 'OpenAI配置缺失',
    OPENAI_API_FAILED: 'OpenAI API调用失败',
    OPENAI_QUOTA_EXCEEDED: 'OpenAI配额已用完',

    // KV存储相关错误
    KV_CONFIG_MISSING: 'KV存储配置缺失',
    KV_OPERATION_FAILED: 'KV存储操作失败',

    // 消息处理相关错误
    MESSAGE_ALREADY_PROCESSED: '消息已处理',
    MESSAGE_FORMAT_INVALID: '消息格式无效',

    // 对话相关错误
    CONVERSATION_NOT_FOUND: '对话记录未找到',
    CONVERSATION_EXPIRED: '对话记录已过期',
};
