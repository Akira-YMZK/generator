import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as XLSX from 'xlsx';

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

async function extractContentFromUrl(url: string): Promise<string> {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    timeout: 10000
  });

  const $ = cheerio.load(response.data);
  $('script, style, nav, header, footer, aside, .advertisement, .ads, .sidebar').remove();

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

  return mainContent
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
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

  try {
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

  } catch (error) {
    console.error('Error structuring job data:', error);
    
    let errorMessage = 'AI構造化に失敗しました';
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const apiErrorMessage = error.response?.data?.error?.message || error.message;
      
      if (status === 402) {
        errorMessage = 'OpenRouter API: 残高不足です。アカウントにクレジットを追加してください。';
      } else if (status === 401) {
        errorMessage = 'OpenRouter API: APIキーが無効です。正しいAPIキーを入力してください。';
      } else if (status === 429) {
        errorMessage = 'OpenRouter API: レート制限に達しました。しばらく待ってから再試行してください。';
      } else if (status) {
        errorMessage = `OpenRouter API エラー (${status}): ${apiErrorMessage}`;
      } else {
        errorMessage = `ネットワークエラー: ${error.message}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    // Return basic structure with extracted content and error info
    return {
      jobTitle: null,
      companyName: null,
      location: null,
      salary: {
        min: null,
        max: null,
        type: null,
        details: null
      },
      workingHours: null,
      holidays: null,
      benefits: [],
      requirements: {
        experience: null,
        skills: [],
        education: null
      },
      jobDescription: `【AI構造化エラー】${errorMessage}\n\n【抽出された生データ】\n${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}`,
      applicationMethod: null,
      employmentType: null,
      url,
      extractedAt: new Date().toISOString()
    };
  }
}

function createExcelFile(jobsData: JobData[]): Buffer {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: 求人一覧
  const summaryData = jobsData.map(job => ({
    '職種': job.jobTitle || '',
    '会社名': job.companyName || '',
    '勤務地': job.location || '',
    '最低給与': job.salary.min || '',
    '最高給与': job.salary.max || '',
    '給与タイプ': job.salary.type || '',
    '雇用形態': job.employmentType || '',
    'URL': job.url,
    '抽出日時': new Date(job.extractedAt).toLocaleString('ja-JP')
  }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, '求人一覧');

  // Sheet 2: 詳細情報
  const detailData = jobsData.map((job, index) => ({
    'No.': index + 1,
    '職種': job.jobTitle || '',
    '会社名': job.companyName || '',
    '勤務地': job.location || '',
    '給与詳細': job.salary.details || '',
    '勤務時間': job.workingHours || '',
    '休日': job.holidays || '',
    '福利厚生': job.benefits.join(', '),
    '必要経験': job.requirements.experience || '',
    '必要スキル': job.requirements.skills.join(', '),
    '学歴要件': job.requirements.education || '',
    '業務内容': job.jobDescription || '',
    '応募方法': job.applicationMethod || '',
    'URL': job.url
  }));

  const detailSheet = XLSX.utils.json_to_sheet(detailData);
  XLSX.utils.book_append_sheet(workbook, detailSheet, '詳細情報');

  // Sheet 3: 統計情報
  const stats = {
    '総求人数': jobsData.length,
    '職種別集計': {} as Record<string, number>,
    '勤務地別集計': {} as Record<string, number>,
    '雇用形態別集計': {} as Record<string, number>
  };

  // 統計データの計算
  jobsData.forEach(job => {
    if (job.jobTitle) {
      stats['職種別集計'][job.jobTitle] = (stats['職種別集計'][job.jobTitle] || 0) + 1;
    }
    if (job.location) {
      stats['勤務地別集計'][job.location] = (stats['勤務地別集計'][job.location] || 0) + 1;
    }
    if (job.employmentType) {
      stats['雇用形態別集計'][job.employmentType] = (stats['雇用形態別集計'][job.employmentType] || 0) + 1;
    }
  });

  const statsData = [
    { '項目': '総求人数', '値': stats['総求人数'] },
    { '項目': '', '値': '' },
    { '項目': '職種別集計', '値': '' },
    ...Object.entries(stats['職種別集計']).map(([key, value]) => ({ '項目': key, '値': value })),
    { '項目': '', '値': '' },
    { '項目': '勤務地別集計', '値': '' },
    ...Object.entries(stats['勤務地別集計']).map(([key, value]) => ({ '項目': key, '値': value })),
    { '項目': '', '値': '' },
    { '項目': '雇用形態別集計', '値': '' },
    ...Object.entries(stats['雇用形態別集計']).map(([key, value]) => ({ '項目': key, '値': value }))
  ];

  const statsSheet = XLSX.utils.json_to_sheet(statsData);
  XLSX.utils.book_append_sheet(workbook, statsSheet, '統計情報');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export async function POST(request: NextRequest) {
  try {
    const { urls, apiKey } = await request.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'URLs array is required' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key is required' },
        { status: 400 }
      );
    }

    const jobsData: JobData[] = [];

    // Process each URL
    for (const url of urls) {
      try {
        console.log(`Processing URL: ${url}`);
        
        // Extract content from URL
        const content = await extractContentFromUrl(url);
        
        // Structure data using AI
        const structuredData = await structureJobData(content, url, apiKey);
        
        jobsData.push(structuredData);
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error processing URL ${url}:`, error);
        let errorMessage = 'Unknown error';
        
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const apiErrorMessage = error.response?.data?.error?.message || error.message;
          
          if (status === 402) {
            errorMessage = 'OpenRouter API: Payment required. Please check your account balance.';
          } else if (status === 401) {
            errorMessage = 'OpenRouter API: Invalid API key.';
          } else if (status === 429) {
            errorMessage = 'OpenRouter API: Rate limit exceeded. Please try again later.';
          } else if (status) {
            errorMessage = `OpenRouter API Error (${status}): ${apiErrorMessage}`;
          } else {
            errorMessage = `Network error: ${error.message}`;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        // Continue with other URLs even if one fails
        jobsData.push({
          jobTitle: null,
          companyName: null,
          location: null,
          salary: { min: null, max: null, type: null, details: null },
          workingHours: null,
          holidays: null,
          benefits: [],
          requirements: { experience: null, skills: [], education: null },
          jobDescription: `Error processing URL: ${errorMessage}`,
          applicationMethod: null,
          employmentType: null,
          url,
          extractedAt: new Date().toISOString()
        });
      }
    }

    // Create Excel file
    const excelBuffer = createExcelFile(jobsData);

    // Return Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="job_data_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });

  } catch (error) {
    console.error('Error in extract-to-excel API:', error);
    
    let errorMessage = 'Failed to process job data extraction';
    let statusCode = 500;
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const apiErrorMessage = error.response?.data?.error?.message || error.message;
      
      if (status === 402) {
        errorMessage = 'OpenRouter API: Payment required. Please check your account balance and try again.';
        statusCode = 402;
      } else if (status === 401) {
        errorMessage = 'OpenRouter API: Invalid API key. Please check your API key.';
        statusCode = 401;
      } else if (status === 429) {
        errorMessage = 'OpenRouter API: Rate limit exceeded. Please try again later.';
        statusCode = 429;
      } else if (status) {
        errorMessage = `OpenRouter API Error (${status}): ${apiErrorMessage}`;
        statusCode = status;
      } else {
        errorMessage = `Network error: ${error.message}`;
      }
    } else if (error instanceof Error) {
      errorMessage = `Processing error: ${error.message}`;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
