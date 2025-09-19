import { serve } from 'https://deno.land/std@0.220.1/http/server.ts';
import { decrypt, encrypt, getSignature } from 'npm:@wecom/crypto';

interface CryptoRequest {
    action: 'encrypt' | 'decrypt' | 'getSignature';
    token: string;
    encodingAESKey: string;
    corpId: string;
    message?: string;
    encrypt?: string;
    timestamp?: string;
    nonce?: string;
    echostr?: string;
}

class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

function validateRequest(data: CryptoRequest) {
    const { action, token, encodingAESKey, corpId } = data;

    function validateCryptoParameters() {
        // 通用参数验证
        if (!token || !encodingAESKey || !corpId) {
            throw new ValidationError('Missing required parameters: token, encodingAESKey, corpId');
        }
    }

    // 根据操作类型验证特定参数
    switch (action) {
        case 'encrypt':
            validateCryptoParameters()
            break;
        case 'decrypt':
            validateCryptoParameters()
            if (!data.encrypt) {
                throw new ValidationError('Missing required parameter: encrypt');
            }
            break;
        case 'getSignature':
            if (!data.echostr || !data.timestamp || !data.nonce) {
                throw new ValidationError('Missing required parameters: echostr, timestamp, nonce');
            }
            break;
        default:
            throw new ValidationError('Invalid action');
    }
}

async function handleRequest(request: Request): Promise<Response> {
    // 只允许 POST 请求
    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const data = (await request.json()) as CryptoRequest;
        console.log('收到请求:', { ...data, encodingAESKey: '***' });

        // 验证请求参数
        validateRequest(data);

        // 执行相应操作
        let result;
        switch (data.action) {
            case 'encrypt':
                result = encrypt(data.encodingAESKey, data.message!, data.corpId);
                break;
            case 'decrypt':
                result = decrypt(data.encodingAESKey, data.encrypt!);
                break;
            case 'getSignature':
                result = getSignature(data.token, data.timestamp!, data.nonce!, data.echostr!);
                break;
        }

        return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('处理请求失败:', error);

        const status = error instanceof ValidationError ? 400 : 500;
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
                type: error.name,
            }),
            {
                status,
                headers: { 'Content-Type': 'application/json' },
            },
        );
    }
}

// 启动服务器
const port = 3001;
console.log(`Crypto service running on http://localhost:${port}`);
await serve(handleRequest, { port });
