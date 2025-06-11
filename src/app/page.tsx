'use client';

import { useState } from 'react';

interface ExtractedData {
  title: string;
  h1: string;
  h2Elements: string[];
  content: string;
  url: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'input' | 'extracted' | 'generated'>('input');

  const handleExtract = async () => {
    if (!url) {
      setError('URLを入力してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'テキスト抽出に失敗しました');
      }

      setExtractedData(data);
      setStep('extracted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      setError('OpenRouter APIキーを入力してください');
      return;
    }

    if (!extractedData) {
      setError('まず求人情報を抽出してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ extractedData, apiKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '紹介文生成に失敗しました');
      }

      setGeneratedContent(data.generatedContent);
      setStep('generated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setUrl('');
    setApiKey('');
    setExtractedData(null);
    setGeneratedContent('');
    setError('');
    setStep('input');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            求人紹介文ジェネレーター
          </h1>

          {/* Step 1: URL Input */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              1. 求人サイトのURLを入力
            </h2>
            <div className="space-y-4">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/job-posting"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              <button
                onClick={handleExtract}
                disabled={loading || !url}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading && step === 'input' ? '抽出中...' : '求人情報を抽出'}
              </button>
            </div>
          </div>

          {/* Step 2: API Key Input */}
          {step !== 'input' && (
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
                <button
                  onClick={handleGenerate}
                  disabled={loading || !apiKey || !extractedData}
                  className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {loading && step === 'extracted' ? '生成中...' : '求人紹介文を生成'}
                </button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Extracted Data Display */}
          {extractedData && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                抽出された情報
              </h2>
              <div className="bg-gray-100 p-6 rounded-lg space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-700">タイトル:</h3>
                  <p className="text-gray-600">{extractedData.title}</p>
                </div>
                {extractedData.h1 && (
                  <div>
                    <h3 className="font-semibold text-gray-700">メイン見出し:</h3>
                    <p className="text-gray-600">{extractedData.h1}</p>
                  </div>
                )}
                {extractedData.h2Elements.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-700">サブ見出し:</h3>
                    <ul className="text-gray-600 list-disc list-inside">
                      {extractedData.h2Elements.map((h2, index) => (
                        <li key={index}>{h2}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-700">内容 (抜粋):</h3>
                  <p className="text-gray-600 text-sm max-h-32 overflow-y-auto">
                    {extractedData.content.substring(0, 500)}...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Generated Content Display */}
          {generatedContent && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                生成された求人紹介文
              </h2>
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="whitespace-pre-wrap text-gray-800">
                  {generatedContent}
                </div>
              </div>
              <div className="mt-4 flex space-x-4">
                <button
                  onClick={() => navigator.clipboard.writeText(generatedContent)}
                  className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  コピー
                </button>
                <button
                  onClick={handleReset}
                  className="bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  新しい求人を処理
                </button>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-6 bg-yellow-50 rounded-lg">
            <h3 className="font-semibold text-yellow-800 mb-2">使用方法:</h3>
            <ol className="text-yellow-700 text-sm space-y-1 list-decimal list-inside">
              <li>求人サイトのURLを入力して「求人情報を抽出」をクリック</li>
              <li>OpenRouter APIキーを入力して「求人紹介文を生成」をクリック</li>
              <li>生成された紹介文をコピーして使用</li>
            </ol>
            <p className="text-yellow-700 text-sm mt-2">
              ※ OpenRouter APIキーは <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="underline">openrouter.ai</a> で取得できます
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
