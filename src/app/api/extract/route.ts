import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Fetch the HTML content
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    // Parse HTML with Cheerio
    const $ = cheerio.load(response.data);

    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .advertisement, .ads, .sidebar').remove();

    // Extract text content
    const title = $('title').text().trim();
    const h1 = $('h1').first().text().trim();
    const h2Elements = $('h2').map((_, el) => $(el).text().trim()).get();
    
    // Get main content text
    let mainContent = '';
    
    // Try to find main content areas
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

    // If no specific content area found, get body text
    if (!mainContent) {
      mainContent = $('body').text().trim();
    }

    // Clean up the text
    mainContent = mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    // Limit content length to avoid API limits
    if (mainContent.length > 3000) {
      mainContent = mainContent.substring(0, 3000) + '...';
    }

    const extractedData = {
      title,
      h1,
      h2Elements: h2Elements.slice(0, 5), // Limit to first 5 h2 elements
      content: mainContent,
      url
    };

    return NextResponse.json(extractedData);

  } catch (error) {
    console.error('Error extracting content:', error);
    return NextResponse.json(
      { error: 'Failed to extract content from URL' },
      { status: 500 }
    );
  }
}
