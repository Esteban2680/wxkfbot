/**
 * OpenAI 服务配置管理
 */

/**
 * OpenAI 服务配置
 */
export const AI_SERVICE = {
  name: 'OpenAI',
  baseUrl: 'https://api.openai.com',
  defaultModel: 'gpt-3.5-turbo',
  requiresApiKey: true,
  description: 'OpenAI 官方 API 服务'
};

/**
 * 从环境变量获取 OpenAI 配置
 */
export function getAIConfig(env) {
  if (!env.OPENAI_API_KEY) {
    throw new Error('未找到 OPENAI_API_KEY，请检查环境变量');
  }

  return {
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL || AI_SERVICE.baseUrl,
    model: env.OPENAI_MODEL || AI_SERVICE.defaultModel,
    timeout: env.OPENAI_TIMEOUT ? parseInt(env.OPENAI_TIMEOUT) : 30000,
    organization: env.OPENAI_ORGANIZATION,
    project: env.OPENAI_PROJECT,
    serviceName: 'openai',
    serviceInfo: AI_SERVICE
  };
}

/**
 * 验证 OpenAI 配置
 */
export function validateAIConfig(config) {
  if (!config) {
    throw new Error('OpenAI 配置不能为空');
  }

  if (!config.apiKey) {
    throw new Error('OpenAI API Key 不能为空');
  }

  if (!config.baseUrl) {
    throw new Error('baseUrl 不能为空');
  }

  if (!config.model) {
    throw new Error('model 不能为空');
  }

  return true;
}

/**
 * 获取 OpenAI 服务状态信息
 */
export function getServiceStatus(config) {
  return {
    service: config.serviceInfo?.name || 'OpenAI',
    baseUrl: config.baseUrl,
    model: config.model,
    hasApiKey: !!config.apiKey,
    timeout: config.timeout
  };
}