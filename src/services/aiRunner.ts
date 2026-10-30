import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAI } from '@ai-sdk/openai';
import { GoogleGenAI } from '@google/genai';

export interface ExecuteAiChatOptions {
  provider: 'gemini' | 'deepseek' | 'openai' | 'custom';
  apiKey: string;
  baseURL?: string;
  modelName: string;
  messages: Array<{ role: string; content: string }>;
  focusWord?: any;
  language?: 'en' | 'ja';
  scenario?: string;
  scenarioRole?: string;
}

export interface AiChatResult {
  reply: string;
  translation: string;
  feedback: {
    isCorrect?: boolean;
    tip?: string;
    exampleUsage?: string;
  };
  challenge: string;
}

export async function executeAiChat(options: ExecuteAiChatOptions): Promise<AiChatResult> {
  const { provider, apiKey, baseURL, modelName, messages, focusWord, language = 'en', scenario = 'daily', scenarioRole } = options;

  if (!apiKey) {
    throw new Error(`未配置 ${provider.toUpperCase()} 的 API Key，请在「设置 -> AI 模型与跨端配置」中绑定。`);
  }

  const langName = language === 'ja' ? 'Japanese (日本語)' : 'English';
  const roleInstruction = scenarioRole
    ? `Custom Role & Persona: "${scenarioRole}". Roleplay this persona accurately while helping the student.`
    : `Scenario context: ${scenario}.`;

  const systemPrompt = `You are an expert bilingual ${langName} conversation tutor and interactive roleplay partner for language learners.
${roleInstruction}
Your goal is to help the user practice and master vocabulary in real-world communicative situations.
Focus word for this session: ${focusWord ? `"${focusWord.headword}" (${focusWord.pos || ''}, meaning: ${JSON.stringify(focusWord.meanings)})` : 'None specified'}.

Response Guidelines:
1. Reply conversationally in ${langName} in a natural, polite, and encouraging tone suitable for intermediate learners, staying in character.
2. In your JSON response, provide:
   - "reply": Your conversational dialogue response in ${langName}.
   - "translation": The fluent Chinese translation of your reply.
   - "feedback": Constructive analysis of the user's latest input. Note whether they used the focus word correctly, any minor grammatical polish, and a brief tip for natural native phrasing.
   - "challenge": A short suggestion or prompt for the user's next turn to keep the dialogue flowing (in Chinese or ${langName}).
3. Return STRICTLY valid JSON conforming to the requested schema. Do not include markdown code block backticks like \`\`\`json.`;

  // Format messages for Vercel AI SDK
  const coreMessages = messages.map((m) => ({
    role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
    content: m.content,
  }));

  // If Gemini provider, use GoogleGenAI with aistudio-build header for maximum speed and compatibility
  if (provider === 'gemini') {
    const aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Support user selected Gemini model precisely (e.g. gemini-3.8-flash, gemini-3.1-flash-lite, gemini-flash-latest, gemini-2.5-pro)
    const targetModel = (!modelName || modelName === 'gemini-2.5-flash') ? 'gemini-3.8-flash' : modelName;

    const contents = [
      {
        role: 'user',
        parts: [
          { text: systemPrompt },
          ...messages.map((m) => ({ text: `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}` })),
        ],
      },
    ];

    const geminiRes = await aiClient.models.generateContent({
      model: targetModel,
      contents,
    });

    const text = geminiRes.text || '';
    const cleanedText = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      parsed = {
        reply: cleanedText,
        translation: '',
        feedback: { isCorrect: true, tip: '对话进行中。' },
        challenge: language === 'ja' ? '次の返答を続けてみてください' : 'Try continuing the conversation.',
      };
    }

    return {
      reply: parsed.reply || cleanedText,
      translation: parsed.translation || '',
      feedback: typeof parsed.feedback === 'object' ? parsed.feedback : { isCorrect: true, tip: parsed.feedback || '' },
      challenge: parsed.challenge || '',
    };
  }

  // DeepSeek, OpenAI, or Custom OpenAI-compatible endpoints via Vercel AI SDK
  let modelInstance: any;
  if (provider === 'deepseek') {
    const deepseek = createDeepSeek({ apiKey });
    modelInstance = deepseek(modelName || 'deepseek-chat');
  } else if (provider === 'openai') {
    const openai = createOpenAI({ apiKey, baseURL: baseURL || undefined });
    modelInstance = openai.chat(modelName || 'gpt-4o-mini');
  } else {
    // Custom OpenAI compatible endpoint (e.g. SiliconFlow, One API, Ollama, OpenRouter)
    // Use .chat() to call /v1/chat/completions (the universal OpenAI standard), avoiding /v1/responses 404
    const cleanBaseUrl = (baseURL || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
    const customOpenai = createOpenAI({
      apiKey,
      baseURL: cleanBaseUrl,
    });
    modelInstance = customOpenai.chat(modelName || 'gpt-4o-mini');
  }

  const { text } = await generateText({
    model: modelInstance,
    system: systemPrompt,
    messages: coreMessages,
    temperature: 0.7,
  });

  const cleanedText = text.trim().replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleanedText);
  } catch {
    parsed = {
      reply: cleanedText,
      translation: '',
      feedback: { isCorrect: true, tip: '对话进行中。' },
      challenge: language === 'ja' ? '次の返答を続けてみてください' : 'Try continuing the conversation.',
    };
  }

  return {
    reply: parsed.reply || cleanedText,
    translation: parsed.translation || '',
    feedback: typeof parsed.feedback === 'object' ? parsed.feedback : { isCorrect: true, tip: parsed.feedback || '' },
    challenge: parsed.challenge || '',
  };
}
