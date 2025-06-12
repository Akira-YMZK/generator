import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface JobData {
  jobTitle: string | null;
  companyName: string | null;
  location: string | null;
  salary: {
    min: number | null;
    max: number | null;
    type: string | null;
    details: string | null;
  };
  workingHours: string | null;
  holidays: string | null;
  benefits: string[];
  requirements: {
    experience: string | null;
    skills: string[];
    education: string | null;
  };
  jobDescription: string | null;
  applicationMethod: string | null;
  employmentType: string | null;
  url: string;
  extractedAt: string;
}

interface PreviewResponse {
  rawData: {
    title: string;
    h1: string;
    h2Elements: string[];
    content: string;
    url: string;
    contentLength: number;
  };
  structuredData: JobData | null;
  error?: string;
  apiKeyValid?: boolean;
}

async function extractContentFromUrl(url: string): Promise<{
  title: string;
  h1: string;
  h2Elements: string[];
  content: string;
  contentLength: number;
}> {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    timeout: 10000
  });

  const $ = cheerio.load(response.data);
  $('script, style, nav, header, footer, aside, .advertisement, .ads, .sidebar').remove();

  const title = $('title').text().trim();
  const h1 = $('h1').first().text().trim();
  const h2Elements = $('h2').map((_, el) => $(el).text().trim()).get().slice(0, 5);

  let mainContent = '';
  const contentSelectors = [
    'main',
    '.content',
    '.main-content',
    '.job-description',
    '.job-detail',
    '.post-content',
    'article',
    '.entry-content'
  ];

  for (const selector of contentSelectors) {
    const content = $(selector).text().trim();
    if (content && content.length > mainContent.length) {
      mainContent = content;
    }
  }

  if (!mainContent) {
    mainContent = $('body').text().trim();
  }

  const cleanContent = mainContent
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();

  return {
    title,
    h1,
    h2Elements,
    content: cleanContent,
    contentLength: cleanContent.length
  };
}

async function validateApiKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ],
        max_tokens: 10
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'API Key Validation'
        }
      }
    );
    return { valid: response.status === 200 };
  } catch (error) {
    console.error('API key validation error:', error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;
      
      if (status === 402) {
        return { valid: false, error: 'OpenRouter API: 残高不足です。アカウントにクレジットを追加してください。' };
      } else if (status === 401) {
        return { valid: false, error: 'OpenRouter API: APIキーが無効です。正しいAPIキーを入力してください。' };
      } else if (status === 429) {
        return { valid: false, error: 'OpenRouter API: レート制限に達しました。しばらく待ってから再試行してください。' };
      } else {
        return { valid: false, error: `OpenRouter API エラー (${status}): ${message}` };
      }
    }
    
    return { valid: false, error: 'APIキーの検証に失敗しました。' };
  }
}

async function structureJobData(content: string, url: string, apiKey: string): Promise<JobData> {
  const structurePrompt = `以下の求人ページから抽出されたテキストを分析し、求人情報をJSON形式で構造化してください。

【抽出されたテキスト】
${content.substring(0, 4000)}

【出力形式】
必ず以下のJSON形式で回答してください。情報が見つからない場合は null または空配列を設定してください。数値は必ず数値型で返してください。

{
  "jobTitle": "職種名",
  "companyName": "会社名",
  "location": "勤務地",
  "salary": {
    "min": 最低給与(数値のみ、万円単位),
    "max": 最高給与(数値のみ、万円単位),
    "type": "月給/年収/時給",
    "details": "給与の詳細説明"
  },
  "workingHours": "勤務時間",
  "holidays": "休日・休暇",
  "benefits": ["福利厚生の配列"],
  "requirements": {
    "experience": "必要経験年数や内容",
    "skills": ["必要スキルの配列"],
    "education": "学歴要件"
  },
  "jobDescription": "業務内容の詳細",
  "applicationMethod": "応募方法",
  "employmentType": "正社員/契約社員/派遣/アルバイト等"
}

JSONのみを返してください。説明文は不要です。`;

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        {
          role: 'user',
          content: structurePrompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.3
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Job Data Extractor'
      }
    }
  );

  const aiResponse = response.data.choices[0].message.content;
  
  // Extract JSON from AI response
  const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON found in AI response');
  }

  const structuredData = JSON.parse(jsonMatch[0]);
  
  return {
    ...structuredData,
    url,
    extractedAt: new Date().toISOString()
  };
}

export async function POST(request: NextRequest) {
  try {
    const { url, apiKey } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Extract raw content
    const rawData = await extractContentFromUrl(url);
    const response: PreviewResponse = {
      rawData: {
        ...rawData,
        url
      },
      structuredData: null
    };

    // If API key is provided, validate it and try to structure data
    if (apiKey) {
      try {
        // Validate API key first
        const keyValidation = await validateApiKey(apiKey);
        response.apiKeyValid = keyValidation.valid;

        if (keyValidation.valid) {
          // Try to structure the data
          const structuredData = await structureJobData(rawData.content, url, apiKey);
          response.structuredData = structuredData;
        } else {
          response.error = keyValidation.error || 'Invalid API key or insufficient credits';
        }
      } catch (error) {
        console.error('Error structuring job data:', error);
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const message = error.response?.data?.error?.message || error.message;
          
          if (status === 402) {
            response.error = 'OpenRouter API: Payment required. Please check your account balance.';
          } else if (status === 401) {
            response.error = 'OpenRouter API: Invalid API key.';
          } else if (status === 429) {
            response.error = 'OpenRouter API: Rate limit exceeded. Please try again later.';
          } else {
            response.error = `OpenRouter API Error (${status}): ${message}`;
          }
        } else {
          response.error = `Structuring error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in preview-extraction API:', error);
    
    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process URL' },
      { status: 500 }
    );
  }
}
