import { useState } from 'react';
import Head from 'next/head';

// ---- Types ----
interface ProfileData {
  row_count: number;
  column_count: number;
  data_quality_score: number;
  missing_percentage: Record<string, number>;
  numeric_statistics: Record<string, { mean: number; std: number; min: number; max: number }>;
  outlier_flags: Record<string, { outlier_count: number; severity: string }>;
}

interface UploadResponse {
  dataset_id: string;
  filename: string;
  profile: ProfileData;
}

interface RAGResponse {
  explanation: string;
  root_cause: string;
  counter_plan: string;
  confidence: string;
  citations: string[];
}

// ---- Main Page ----
export default function Home() {
  const [activeTab, setActiveTab] = useState<'summary' | 'compare' | 'charts' | 'ml'>('summary');
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // RAG drawer
  const [ragOpen, setRagOpen] = useState(false);
  const [ragQuestion, setRagQuestion] = useState('');
  const [ragResponse, setRagResponse] = useState<RAGResponse | null>(null);
  const [ragLoading, setRagLoading] = useState(false);

  // Compare state
  const [groupBy, setGroupBy] = useState('');
  const [metrics, setMetrics] = useState('');
  const [compareResult, setCompareResult] = useState<any>(null);

  // Chart state
  const [chartType, setChartType] = useState('bar');
  const [chartX, setChartX] = useState('');
  const [chartY, setChartY] = useState('');
  const [chartResult, setChartResult] = useState<any>(null);

  // ML state
  const [mlTask, setMlTask] = useState('kmeans');
  const [mlColumns, setMlColumns] = useState('');
  const [mlTarget, setMlTarget] = useState('');
  const [mlResult, setMlResult] = useState<any>(null);

  const API = '/api';

  // ---- Upload ----
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API}/datasets/`, { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || res.statusText);
      }
      const data: UploadResponse = await res.json();
      setDatasetId(data.dataset_id);
      setFilename(data.filename);
      setProfile(data.profile);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ---- RAG Chat ----
  const handleRag = async () => {
    if (!ragQuestion.trim()) return;
    setRagLoading(true);
    try {
      const res = await fetch(`${API}/rag/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: ragQuestion, dataset_id: datasetId || '' }),
      });
      const data: RAGResponse = await res.json();
      setRagResponse(data);
    } catch {
      setRagResponse(null);
    } finally {
      setRagLoading(false);
    }
  };

  // ---- Compare ----
  const handleCompare = async () => {
    if (!datasetId || !groupBy || !metrics) return;
    try {
      const res = await fetch(`${API}/datasets/${datasetId}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_by: groupBy, metrics: metrics.split(',').map(s => s.trim()) }),
      });
      const data = await res.json();
      setCompareResult(data);
    } catch {
      setCompareResult(null);
    }
  };

  // ---- Chart ----
  const handleChart = async () => {
    if (!datasetId || !chartX) return;
    try {
      const res = await fetch(`${API}/datasets/${datasetId}/charts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart_type: chartType, x: chartX, y: chartY || undefined }),
      });
      const data = await res.json();
      setChartResult(data);
    } catch {
      setChartResult(null);
    }
  };

  // ---- ML ----
  const handleML = async () => {
    if (!datasetId || !mlColumns) return;
    try {
      const res = await fetch(`${API}/datasets/${datasetId}/ml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: mlTask,
          columns: mlColumns.split(',').map(s => s.trim()),
          target: mlTarget || undefined,
        }),
      });
      const data = await res.json();
      setMlResult(data);
    } catch {
      setMlResult(null);
    }
  };

  const columns = profile ? Object.keys(profile.missing_percentage) : [];

  // ---- Render ----
  return (
    <>
      <Head>
        <title>AADES – Adaptive Auto Data Evaluation System</title>
      </Head>

      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-indigo-400">AADES</span> Adaptive Auto Data Evaluation System
          </h1>
          <button
            onClick={() => setRagOpen(!ragOpen)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            💬 RAG Help
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-72 bg-gray-900 border-r border-gray-800 p-5 flex flex-col gap-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Upload Dataset</h2>
              <label className="block border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 transition">
                <input type="file" accept=".csv,.xlsx,.xls,.json" onChange={handleUpload} className="hidden" />
                <span className="text-gray-400 text-sm">
                  {uploading ? 'Uploading…' : 'Drop or click – CSV, Excel, JSON'}
                </span>
              </label>
              {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
            </div>

            {profile && (
              <div className="space-y-2 text-sm">
                <p className="text-gray-400">File: <span className="text-gray-200">{filename}</span></p>
                <p className="text-gray-400">Rows: <span className="text-gray-200">{profile.row_count}</span></p>
                <p className="text-gray-400">Columns: <span className="text-gray-200">{profile.column_count}</span></p>
                <p className="text-gray-400">Quality Score:
                  <span className={`ml-1 font-bold ${profile.data_quality_score >= 70 ? 'text-emerald-400' : profile.data_quality_score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {profile.data_quality_score}
                  </span>
                </p>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mt-3">Columns</h3>
                <ul className="max-h-48 overflow-y-auto space-y-0.5">
                  {columns.map(c => (
                    <li key={c} className="text-gray-300 text-xs truncate">{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-6">
            {!profile ? (
              <div className="flex items-center justify-center h-full text-gray-600 text-lg">
                Upload a dataset to get started.
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex gap-1 mb-6 border-b border-gray-800">
                  {(['summary', 'compare', 'charts', 'ml'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 text-sm font-medium capitalize transition border-b-2 ${
                        activeTab === tab
                          ? 'border-indigo-500 text-indigo-400'
                          : 'border-transparent text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {tab === 'summary' ? 'Overall Summary' : tab === 'compare' ? 'Comparative' : tab === 'charts' ? 'Visualizer' : 'ML'}
                    </button>
                  ))}
                </div>

                {/* Tab: Summary */}
                {activeTab === 'summary' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <Card title="Rows" value={profile.row_count} />
                      <Card title="Columns" value={profile.column_count} />
                      <Card title="Quality Score" value={profile.data_quality_score} color={profile.data_quality_score >= 70 ? 'emerald' : profile.data_quality_score >= 40 ? 'yellow' : 'red'} />
                    </div>

                    {/* Warnings & Alerts */}
                    {Object.keys(profile.outlier_flags).length > 0 && (
                      <div className="bg-gray-900 border border-yellow-700 rounded-lg p-4">
                        <h3 className="text-yellow-400 font-semibold mb-2">⚠️ Warnings &amp; Alerts</h3>
                        <ul className="space-y-1 text-sm">
                          {Object.entries(profile.outlier_flags).map(([col, info]) => (
                            <li key={col} className="text-gray-300">
                              <span className={`inline-block w-16 text-xs font-bold uppercase ${info.severity === 'high' ? 'text-red-400' : info.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'}`}>
                                {info.severity}
                              </span>
                              Column &quot;{col}&quot; has {info.outlier_count} outlier(s).
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Missing Values */}
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                      <h3 className="text-gray-300 font-semibold mb-2">Missing Values (%)</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        {Object.entries(profile.missing_percentage).map(([col, pct]) => (
                          <div key={col} className="flex justify-between">
                            <span className="text-gray-400 truncate mr-2">{col}</span>
                            <span className={pct > 20 ? 'text-red-400' : pct > 0 ? 'text-yellow-400' : 'text-emerald-400'}>{pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Numeric Stats */}
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                      <h3 className="text-gray-300 font-semibold mb-2">Numeric Statistics</h3>
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="text-gray-500 border-b border-gray-800">
                            <th className="py-1">Column</th><th>Mean</th><th>Std</th><th>Min</th><th>Max</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(profile.numeric_statistics).map(([col, s]) => (
                            <tr key={col} className="border-b border-gray-800/50 text-gray-300">
                              <td className="py-1">{col}</td><td>{s.mean}</td><td>{s.std}</td><td>{s.min}</td><td>{s.max}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab: Comparative */}
                {activeTab === 'compare' && (
                  <div className="space-y-4">
                    <div className="flex gap-3 items-end flex-wrap">
                      <label className="text-sm text-gray-400">
                        Group By
                        <input value={groupBy} onChange={e => setGroupBy(e.target.value)} placeholder="e.g. Region" className="mt-1 block w-48 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200" />
                      </label>
                      <label className="text-sm text-gray-400">
                        Metrics (comma-separated)
                        <input value={metrics} onChange={e => setMetrics(e.target.value)} placeholder="e.g. Sales,Profit" className="mt-1 block w-64 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200" />
                      </label>
                      <button onClick={handleCompare} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-sm font-medium transition">Run</button>
                    </div>
                    {compareResult && (
                      <pre className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(compareResult, null, 2)}
                      </pre>
                    )}
                  </div>
                )}

                {/* Tab: Charts */}
                {activeTab === 'charts' && (
                  <div className="space-y-4">
                    <div className="flex gap-3 items-end flex-wrap">
                      <label className="text-sm text-gray-400">
                        Chart Type
                        <select value={chartType} onChange={e => setChartType(e.target.value)} className="mt-1 block w-36 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200">
                          {['bar','line','scatter','pie','heatmap','boxplot','violin'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </label>
                      <label className="text-sm text-gray-400">
                        X Axis
                        <input value={chartX} onChange={e => setChartX(e.target.value)} placeholder="column name" className="mt-1 block w-40 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200" />
                      </label>
                      <label className="text-sm text-gray-400">
                        Y Axis
                        <input value={chartY} onChange={e => setChartY(e.target.value)} placeholder="column name (optional)" className="mt-1 block w-40 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200" />
                      </label>
                      <button onClick={handleChart} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-sm font-medium transition">Generate</button>
                    </div>
                    {chartResult && (
                      <>
                        {chartResult.commentary && <p className="text-sm text-gray-400 italic">{chartResult.commentary}</p>}
                        <pre className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(chartResult.plotly_spec || chartResult, null, 2)}
                        </pre>
                      </>
                    )}
                  </div>
                )}

                {/* Tab: ML */}
                {activeTab === 'ml' && (
                  <div className="space-y-4">
                    <div className="flex gap-3 items-end flex-wrap">
                      <label className="text-sm text-gray-400">
                        Task
                        <select value={mlTask} onChange={e => setMlTask(e.target.value)} className="mt-1 block w-36 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200">
                          <option value="kmeans">K-Means</option>
                          <option value="regression">Linear Regression</option>
                        </select>
                      </label>
                      <label className="text-sm text-gray-400">
                        Columns (comma-separated)
                        <input value={mlColumns} onChange={e => setMlColumns(e.target.value)} placeholder="e.g. col1,col2" className="mt-1 block w-56 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200" />
                      </label>
                      {mlTask === 'regression' && (
                        <label className="text-sm text-gray-400">
                          Target Column
                          <input value={mlTarget} onChange={e => setMlTarget(e.target.value)} placeholder="e.g. Price" className="mt-1 block w-40 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200" />
                        </label>
                      )}
                      <button onClick={handleML} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-sm font-medium transition">Run ML</button>
                    </div>
                    {mlResult && (
                      <pre className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(mlResult, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </>
            )}
          </main>

          {/* RAG Help Drawer */}
          {ragOpen && (
            <aside className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col">
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="font-semibold text-indigo-400">💬 RAG Help</h2>
                <button onClick={() => setRagOpen(false)} className="text-gray-500 hover:text-gray-300 text-lg">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {ragResponse && (
                  <div className="space-y-3">
                    <Block title="Explanation" color="indigo">{ragResponse.explanation}</Block>
                    <Block title="Root Cause" color="yellow">{ragResponse.root_cause}</Block>
                    <Block title="Counter-Plan" color="emerald">{ragResponse.counter_plan}</Block>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${ragResponse.confidence === 'high' ? 'bg-emerald-900 text-emerald-300' : ragResponse.confidence === 'medium' ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>
                        {ragResponse.confidence} confidence
                      </span>
                      <span>Citations: {ragResponse.citations.join(', ')}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-gray-800">
                <div className="flex gap-2">
                  <input
                    value={ragQuestion}
                    onChange={e => setRagQuestion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRag()}
                    placeholder="Ask about your data…"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200"
                  />
                  <button onClick={handleRag} disabled={ragLoading} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-sm font-medium transition disabled:opacity-50">
                    {ragLoading ? '…' : 'Ask'}
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </>
  );
}

// ---- Small Components ----

function Card({ title, value, color = 'indigo' }: { title: string; value: number | string; color?: string }) {
  const textColor = color === 'emerald' ? 'text-emerald-400' : color === 'yellow' ? 'text-yellow-400' : color === 'red' ? 'text-red-400' : 'text-indigo-400';
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${textColor}`}>{value}</p>
    </div>
  );
}

function Block({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const border = color === 'indigo' ? 'border-indigo-700' : color === 'yellow' ? 'border-yellow-700' : 'border-emerald-700';
  return (
    <div className={`border-l-4 ${border} bg-gray-800/50 rounded-r-lg p-3`}>
      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">{title}</h4>
      <p className="text-sm text-gray-300">{children}</p>
    </div>
  );
}

