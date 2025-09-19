import { XMLParser } from 'fast-xml-parser';

/**
 * 微信企业号消息加解密类
 * 使用 Web Crypto API 实现
 */

const CRYPTO_SERVICE_URL = 'https://wecom-crypto.deno.dev';

// 解密
async function decrypt(token, encodingAESKey, corpId, encrypt) {
    const response = await fetch(CRYPTO_SERVICE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'decrypt',
            token,
            encodingAESKey,
            corpId,
            encrypt,
        }),
    });

    if (!response.ok) {
        throw new Error(`Crypto service error: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
        throw new Error(`Crypto operation failed: ${result.error}`);
    }

    return result.data;
}

// 加密
async function encrypt(token, encodingAESKey, corpId, message) {
    const response = await fetch(CRYPTO_SERVICE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'encrypt',
            token,
            encodingAESKey,
            corpId,
            message,
        }),
    });

    if (!response.ok) {
        throw new Error(`Crypto service error: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
        throw new Error(`Crypto operation failed: ${result.error}`);
    }

    return result.data;
}

// 获取签名
async function getSignature(token, timestamp, nonce, echostr) {
    const response = await fetch(CRYPTO_SERVICE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'getSignature',
            token,
            timestamp,
            nonce,
            echostr,
        }),
    });

    if (!response.ok) {
        throw new Error(`Crypto service error: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
        throw new Error(`Crypto operation failed: ${result.error}`);
    }

    return result.data;
}

/**
 * XML解析和生成
 */
export class XMLParse {
    extract(xmltext) {
        try {
            const regex = /<Encrypt>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/Encrypt>/;
            const match = xmltext.match(regex);
            if (match) {
                return { ret: 0, encrypt: match[1] };
            }
            return { ret: -40002, encrypt: null };
        } catch (error) {
            console.error('XML解析失败:', error);
            return { ret: -40002, encrypt: null };
        }
    }

    generate(encrypt, signature, timestamp, nonce) {
        return `<xml>
<Encrypt><![CDATA[${encrypt}]]></Encrypt>
<MsgSignature><![CDATA[${signature}]]></MsgSignature>
<TimeStamp>${timestamp}</TimeStamp>
<Nonce><![CDATA[${nonce}]]></Nonce>
</xml>`;
    }

    /**
     * 简单的XML解析器
     */
    parseXML(xmlString) {
        const parser = new XMLParser();
        return parser.parse(xmlString);
    }
}

/**
 * 微信消息加解密主类
 */
export class WXBizMsgCrypt {
    constructor(sToken, sEncodingAESKey, sCorpId) {
        if (!sToken || !sEncodingAESKey || !sCorpId) {
            throw new Error('参数不能为空');
        }

        this.token = sToken;
        this.encodingAESKey = sEncodingAESKey;
        this.corpId = sCorpId;
    }

    /**
     * 验证URL
     */
    async verifyURL(sMsgSignature, sTimeStamp, sNonce, sEchoStr) {
        try {
            const { message } = await decrypt(this.token, this.encodingAESKey, this.corpId, sEchoStr);
            const signature = await getSignature(this.token, sTimeStamp, sNonce, sEchoStr);
            if (signature !== sMsgSignature) {
                console.error('签名验证失败');
                return {
                    ret: -40001,
                    decryptedEchostr: '',
                    details: {
                        message,
                        signature,
                        sMsgSignature,
                        sTimeStamp,
                        sNonce,
                        sEchoStr,
                    },
                };
            }

            return { ret: 0, decryptedEchostr: message };
        } catch (error) {
            console.error('验证URL失败:', error);
            return { ret: -40001, decryptedEchostr: '', details: { error: error.message } };
        }
    }

    /**
     * 加密消息
     */
    async encryptMsg(sReplyMsg, sNonce, timestamp = null) {
        try {
            if (timestamp === null) {
                timestamp = Math.floor(Date.now() / 1000).toString();
            }

            const ciphered = await encrypt(this.token, this.encodingAESKey, this.corpId, sReplyMsg);
            const signature = await getSignature(this.token, timestamp, sNonce, ciphered);

            const xmlParse = new XMLParse();
            const encryptMsg = xmlParse.generate(ciphered, signature, timestamp, sNonce);

            return { ret: 0, encryptMsg };
        } catch (error) {
            console.error('加密消息失败:', error);
            return { ret: -40006, encryptMsg: '' };
        }
    }

    /**
     * 解密消息
     */
    async decryptMsg(sPostData, sMsgSignature, sTimeStamp, sNonce) {
        try {
            const xmlParse = new XMLParse();
            const { ret: extractRet, encrypt } = xmlParse.extract(sPostData);

            if (extractRet !== 0) {
                return { ret: extractRet, decryptedXml: '' };
            }

            const signature = await getSignature(this.token, sTimeStamp, sNonce, encrypt);

            if (signature !== sMsgSignature) {
                return {
                    ret: -40001,
                    decryptedXml: null,
                    details: { signature, sMsgSignature, sTimeStamp, sNonce, encrypt },
                };
            }

            // 解密消息
            const result = await decrypt(this.token, this.encodingAESKey, this.corpId, encrypt);

            return { ret: 0, decryptedXml: result.message };
        } catch (error) {
            console.error('解密消息失败:', error);
            return { ret: -40007, decryptedXml: null, error: error.message };
        }
    }

    /**
     * 测试加解密功能
     */
    async testCrypto() {
        try {
            const testMessage = 'Hello WeChat!';
            const nonce = 'test_nonce';
            const timestamp = Math.floor(Date.now() / 1000).toString();

            console.log('开始测试加解密功能...');

            // 测试加密
            const { ret: encryptRet, encryptMsg } = await this.encryptMsg(testMessage, nonce, timestamp);
            if (encryptRet !== 0) {
                throw new Error(`加密失败，错误码: ${encryptRet}`);
            }

            console.log('加密成功');

            // 模拟签名验证和解密
            const xmlParse = new XMLParse();
            const parsedXml = xmlParse.parseXML(encryptMsg);

            console.log('parsedXml:', parsedXml);

            const { ret: decryptRet, decryptedXml } = await this.decryptMsg(
                encryptMsg,
                parsedXml.MsgSignature,
                parsedXml.TimeStamp,
                parsedXml.Nonce,
            );

            if (decryptRet !== 0) {
                throw new Error(`解密失败，错误码: ${decryptRet} [${parsedXml}]`);
            }

            console.log('解密成功，原始消息:', testMessage);
            console.log('解密后消息:', decryptedXml);

            return {
                success: true,
                message: '加解密测试通过',
                original: testMessage,
                decrypted: decryptedXml,
            };
        } catch (error) {
            console.error('加解密测试失败:', error);
            return {
                success: false,
                message: error.message,
            };
        }
    }
}
