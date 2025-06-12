'use client';

import { useState } from 'react';
import Link from 'next/link';

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

interface PreviewData {
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

export default function JobExtractor() {
  const [urls, setUrls] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleExtractAndDownload = async () => {
    if (!urls.trim()) {
      setError('URLを入力してください');
      return;
    }

    if (!apiKey.trim()) {
      setError('OpenRouter APIキーを入力してください');
      return;
    }

    const urlList = urls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urlList.length === 0) {
      setError('有効なURLを入力してください');
      return;
    }

    setLoading(true);
    setError('');
    setProgress(`${urlList.length}件のURLを処理中...`);

    try {
      const response = await fetch('/api/extract-to-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          urls: urlList, 
          apiKey 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Excel生成に失敗しました');
      }

      // Download the Excel file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `job_data_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setProgress('Excelファイルのダウンロードが完了しました！');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!urls.trim()) {
      setError('URLを入力してください');
      return;
    }

    const urlList = urls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urlList.length === 0) {
      setError('有効なURLを入力してください');
      return;
    }

    // For preview, only process first URL
    const previewUrl = urlList[0];
    
    setLoading(true);
    setError('');
    setProgress('プレビュー用データを取得中...');

    try {
      const response = await fetch('/api/preview-extraction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: previewUrl, 
          apiKey: apiKey.trim() || undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'プレビューデータの取得に失敗しました');
      }

      const data: PreviewData = await response.json();
      setPreviewData(data);
      setShowPreview(true);
      setProgress('');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setUrls('');
    setApiKey('');
    setError('');
    setProgress('');
    setPreviewData(null);
    setShowPreview(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            求人情報Excel抽出ツール
          </h1>

          {/* Navigation */}
          <div className="mb-6 text-center">
            <Link 
              href="/" 
              className="text-blue-600 hover:text-blue-800 underline"
            >
              ← 求人紹介文ジェネレーターに戻る
            </Link>
          </div>

          {/* URL Input */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              1. 求人サイトのURLを入力
            </h2>
            <div className="space-y-4">
              <textarea
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder={`求人サイトのURLを入力してください（複数の場合は改行で区切る）

例:
https://example.com/job1
https://example.com/job2
https://example.com/job3`}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 resize-vertical"
                disabled={loading}
              />
              <div className="text-sm text-gray-600">
                複数のURLを処理する場合は、1行に1つずつURLを入力してください
              </div>
            </div>
          </div>

          {/* API Key Input */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              2. OpenRouter APIキーを入力
            </h2>
            <div className="space-y-4">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              <div className="text-sm text-gray-600">
                APIキーは <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">openrouter.ai</a> で取得できます
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              3. 抽出・ダウンロード
            </h2>
            <div className="flex space-x-4">
              <button
                onClick={handlePreview}
                disabled={loading || !urls.trim()}
                className="bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '処理中...' : 'プレビュー（1件目のみ）'}
              </button>
              <button
                onClick={handleExtractAndDownload}
                disabled={loading || !urls.trim() || !apiKey.trim()}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '処理中...' : 'Excelファイルを生成・ダウンロード'}
              </button>
              <button
                onClick={handleReset}
                disabled={loading}
                className="bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                リセット
              </button>
            </div>
          </div>

          {/* Progress Display */}
          {progress && (
            <div className="mb-6 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded-lg">
              {progress}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Preview Display */}
          {showPreview && previewData && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                抽出プレビュー
              </h2>
              
              {/* Raw Data */}
              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <h3 className="font-semibold text-gray-700 mb-3">抽出された生データ</h3>
                <div className="space-y-3">
                  <div>
                    <span className="font-medium text-gray-600">URL:</span>
                    <p className="text-sm text-blue-600 break-all">{previewData.rawData.url}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">タイトル:</span>
                    <p className="text-gray-800">{previewData.rawData.title || '取得できませんでした'}</p>
                  </div>
                  {previewData.rawData.h1 && (
                    <div>
                      <span className="font-medium text-gray-600">メイン見出し:</span>
                      <p className="text-gray-800">{previewData.rawData.h1}</p>
                    </div>
                  )}
                  {previewData.rawData.h2Elements.length > 0 && (
                    <div>
                      <span className="font-medium text-gray-600">サブ見出し:</span>
                      <ul className="text-gray-800 list-disc list-inside ml-4">
                        {previewData.rawData.h2Elements.map((h2, index) => (
                          <li key={index}>{h2}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-gray-600">
                      コンテンツ長: {previewData.rawData.contentLength.toLocaleString()}文字
                    </span>
                    <div className="mt-2">
                      <details className="cursor-pointer">
                        <summary className="font-medium text-gray-600 hover:text-gray-800">
                          抽出されたテキスト内容を表示 (先頭1000文字)
                        </summary>
                        <div className="mt-2 p-3 bg-white border rounded text-sm text-gray-700 max-h-40 overflow-y-auto">
                          {previewData.rawData.content.substring(0, 1000)}
                          {previewData.rawData.content.length > 1000 && '...'}
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              </div>

              {/* API Key Status */}
              {apiKey && (
                <div className="mb-6">
                  <div className={`p-4 rounded-lg ${
                    previewData.apiKeyValid 
                      ? 'bg-green-100 border border-green-400 text-green-700'
                      : 'bg-red-100 border border-red-400 text-red-700'
                  }`}>
                    <div className="font-medium">
                      APIキー状態: {previewData.apiKeyValid ? '✅ 有効' : '❌ 無効または残高不足'}
                    </div>
                    {previewData.error && (
                      <div className="text-sm mt-2 p-2 bg-white bg-opacity-50 rounded">
                        <strong>エラー詳細:</strong> {previewData.error}
                      </div>
                    )}
                    {!previewData.apiKeyValid && (
                      <div className="text-sm mt-2 p-2 bg-white bg-opacity-50 rounded">
                        <strong>対処法:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li><a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="underline">OpenRouter</a>でアカウント残高を確認</li>
                          <li>APIキーが正しく入力されているか確認</li>
                          <li>必要に応じてクレジットを追加</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Structured Data */}
              {previewData.structuredData ? (
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-3">AI構造化結果</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-blue-700">職種:</span>
                      <p className="text-blue-900">{previewData.structuredData.jobTitle || '未取得'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-blue-700">会社名:</span>
                      <p className="text-blue-900">{previewData.structuredData.companyName || '未取得'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-blue-700">勤務地:</span>
                      <p className="text-blue-900">{previewData.structuredData.location || '未取得'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-blue-700">雇用形態:</span>
                      <p className="text-blue-900">{previewData.structuredData.employmentType || '未取得'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-medium text-blue-700">給与:</span>
                      <p className="text-blue-900">
                        {previewData.structuredData.salary.details || 
                         `${previewData.structuredData.salary.min || '?'}万円 - ${previewData.structuredData.salary.max || '?'}万円 (${previewData.structuredData.salary.type || '未取得'})`}
                      </p>
                    </div>
                    {previewData.structuredData.benefits.length > 0 && (
                      <div className="md:col-span-2">
                        <span className="font-medium text-blue-700">福利厚生:</span>
                        <p className="text-blue-900">{previewData.structuredData.benefits.join(', ')}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 p-6 rounded-lg">
                  <h3 className="font-semibold text-yellow-800 mb-2">AI構造化未実行</h3>
                  <p className="text-yellow-700 text-sm">
                    {!apiKey 
                      ? 'APIキーを入力すると、AIによる構造化プレビューが表示されます'
                      : 'APIキーの問題により構造化できませんでした'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Features Description */}
          <div className="mt-8 p-6 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-4">機能説明:</h3>
            <div className="text-blue-700 text-sm space-y-2">
              <div className="font-semibold">抽出される情報:</div>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>基本情報: 職種、会社名、勤務地</li>
                <li>待遇: 給与（最低・最高）、給与タイプ、詳細</li>
                <li>勤務条件: 勤務時間、休日・休暇、福利厚生</li>
                <li>応募条件: 必要経験、スキル、学歴要件</li>
                <li>その他: 業務内容、応募方法、雇用形態</li>
              </ul>
              
              <div className="font-semibold mt-4">Excelファイル構成:</div>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>シート1: 求人一覧（概要情報）</li>
                <li>シート2: 詳細情報（全項目）</li>
                <li>シート3: 統計情報（職種別・勤務地別集計）</li>
              </ul>
            </div>
          </div>

          {/* Usage Instructions */}
          <div className="mt-6 p-6 bg-yellow-50 rounded-lg">
            <h3 className="font-semibold text-yellow-800 mb-2">使用方法:</h3>
            <ol className="text-yellow-700 text-sm space-y-1 list-decimal list-inside">
              <li>求人サイトのURLを入力（複数可、改行区切り）</li>
              <li>OpenRouter APIキーを入力</li>
              <li>「プレビュー」で1件目の抽出結果を確認（オプション）</li>
              <li>「Excelファイルを生成・ダウンロード」でファイル取得</li>
            </ol>
            <div className="mt-4 text-yellow-700 text-sm">
              <strong>注意:</strong> 
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>処理には時間がかかる場合があります（1URLあたり約1-2秒）</li>
                <li>OpenRouter APIの使用料金が発生します</li>
                <li>一部のサイトではアクセス制限により抽出できない場合があります</li>
                <li>APIキーに問題がある場合でも、基本的な抽出データはExcelに含まれます</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
