import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const { extractedData, apiKey } = await request.json();

    if (!extractedData || !apiKey) {
      return NextResponse.json(
        { error: 'Extracted data and API key are required' },
        { status: 400 }
      );
    }

    const { title, h1, h2Elements, content } = extractedData;

    // Create a prompt for job description generation
    const prompt = `以下の求人情報から、魅力的で読みやすい求人紹介文を生成してください。

【元の求人情報】
タイトル: ${title}
見出し: ${h1}
サブ見出し: ${h2Elements.join(', ')}
内容: ${content}

【生成する紹介文の要件】
- 300-500文字程度
- 求職者にとって魅力的な内容
- 職種、業務内容、待遇などの重要な情報を含める
- 読みやすく、親しみやすい文体
- 箇条書きや改行を適切に使用

求人紹介文:`;

    // Call OpenRouter API
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Job Description Generator'
        }
      }
    );

    const generatedContent = response.data.choices[0].message.content;

    return NextResponse.json({
      generatedContent,
      originalData: extractedData
    });

  } catch (error) {
    console.error('Error generating content:', error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.error?.message || 'Failed to generate content';
      return NextResponse.json(
        { error: `OpenRouter API Error: ${message}` },
        { status }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
}
