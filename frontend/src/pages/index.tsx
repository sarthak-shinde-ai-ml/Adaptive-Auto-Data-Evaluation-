import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

declare global {
  interface Window {
    Plotly?: any;
  }
}

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

export default function Home() {
  const [activeTab, setActiveTab] = useState<'summary' | 'compare' | 'charts' | 'ml'>('summary');
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Column lists
  const [allColumns, setAllColumns] = useState<string[]>([]);
  const [numericCols, setNumericCols] = useState<string[]>([]);
  const [catCols, setCatCols] = useState<string[]>([]);

  // RAG drawer
  const [ragOpen, setRagOpen] = useState(false);
  const [ragQuestion, setRagQuestion] = useState('');
  const [ragResponse, setRagResponse] = useState<RAGResponse | null>(null);
  const [ragLoading, setRagLoading] = useState(false);

  // Compare state: STRICTLY USER SELECTED (default empty)
  const [groupBy, setGroupBy] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [compareResult, setCompareResult] = useState<any>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Chart state
  const [chartType, setChartType] = useState('bar');
  const [chartX, setChartX] = useState('');
  const [chartY, setChartY] = useState('');
  const [chartResult, setChartResult] = useState<any>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // ML state: STRICTLY USER SELECTED (default empty)
  const [mlTask, setMlTask] = useState<'kmeans' | 'regression'>('kmeans');
  const [mlFeatures, setMlFeatures] = useState<string[]>([]);
  const [mlTarget, setMlTarget] = useState('');
  const [mlResult, setMlResult] = useState<any>(null);
  const [mlLoading, setMlLoading] = useState(false);

  // PDF Report
  const [pdfDownloading, setPdfDownloading] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

  // ---- Handle Column Setup on Upload (User Selects Their Own Metrics) ----
  useEffect(() => {
    if (profile) {
      const all = Object.keys(profile.missing_percentage);
      const num = Object.keys(profile.numeric_statistics);
      const cat = all.filter(c => !num.includes(c));

      setAllColumns(all);
      setNumericCols(num);
      setCatCols(cat);

      // Default X axis / group by to the first category, but LEAVE METRICS & FEATURES EMPTY FOR USER TO SELECT
      setGroupBy(cat[0] || all[0] || '');
      setSelectedMetrics([]); // User selects their own metrics

      setChartX(cat[0] || all[0] || '');
      setChartY(num[0] || '');

      setMlTarget(num[0] || '');
      setMlFeatures([]); // User selects their own feature columns
    }
  }, [profile]);

  // ---- Render Plotly Chart When chartResult is updated ----
  useEffect(() => {
    if (chartResult && chartResult.plotly_spec && typeof window !== 'undefined') {
      const renderPlot = () => {
        if (window.Plotly && chartContainerRef.current) {
          const spec = chartResult.plotly_spec;
          const layout = {
            ...spec.layout,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { color: '#94a3b8', family: 'system-ui, sans-serif' },
            xaxis: {
              ...spec.layout?.xaxis,
              gridcolor: '#1e293b',
              zerolinecolor: '#334155',
            },
            yaxis: {
              ...spec.layout?.yaxis,
              gridcolor: '#1e293b',
              zerolinecolor: '#334155',
            },
            margin: { t: 40, r: 25, l: 60, b: 60 },
            autosize: true,
          };
          window.Plotly.newPlot(chartContainerRef.current, spec.data, layout, {
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
          });
        }
      };

      if (window.Plotly) {
        renderPlot();
      } else {
        const timer = setTimeout(renderPlot, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [chartResult, activeTab]);

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
      setCompareResult(null);
      setChartResult(null);
      setMlResult(null);
      setActiveTab('summary');
    } catch (err: any) {
      setError(err.message || 'Upload failed. Check if server is running.');
    } finally {
      setUploading(false);
    }
  };

  // ---- Run Compare ----
  const handleCompare = async () => {
    if (!datasetId || !groupBy) return;
    if (selectedMetrics.length === 0) {
      alert('Please select at least one numeric metric to compare.');
      return;
    }
    setCompareLoading(true);
    try {
      const res = await fetch(`${API}/datasets/${datasetId}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_by: groupBy, metrics: selectedMetrics }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Comparative analysis failed');
      setCompareResult(data.result);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCompareLoading(false);
    }
  };

  // ---- Run Chart ----
  const handleChart = async () => {
    if (!datasetId || !chartX) {
      alert('Please select an X-Axis column.');
      return;
    }
    setChartLoading(true);
    try {
      const res = await fetch(`${API}/datasets/${datasetId}/charts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chart_type: chartType,
          x: chartX,
          y: chartY || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Chart generation failed');
      setChartResult(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setChartLoading(false);
    }
  };

  // ---- Run ML ----
  const handleML = async () => {
    if (!datasetId) return;
    if (mlFeatures.length === 0) {
      alert('Please select at least one feature column for the model.');
      return;
    }
    setMlLoading(true);
    try {
      const res = await fetch(`${API}/datasets/${datasetId}/ml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: mlTask,
          columns: mlFeatures,
          target: mlTask === 'regression' ? mlTarget : undefined,
          k: 3,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Machine learning execution failed');
      setMlResult(data.result);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setMlLoading(false);
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

  // ---- Download PDF Report ----
  const handleDownloadPDF = async () => {
    if (!datasetId) return;
    setPdfDownloading(true);
    try {
      const res = await fetch(`${API}/reports/${datasetId}/download`);
      if (!res.ok) throw new Error('PDF compilation failed on server');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AADES_Evaluation_Report_${datasetId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Error downloading report: ' + err.message);
    } finally {
      setPdfDownloading(false);
    }
  };

  return (
    <>
      <Head>
        <title>AADES – Adaptive Auto Data Evaluation System v3.0</title>
        {/* Load Plotly.js for visual chart rendering */}
        <script src="https://cdn.plot.ly/plotly-2.30.0.min.js" async></script>
      </Head>

      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {/* Top Header */}
        <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
              A
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                AADES <span className="text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800 font-mono">v3.0</span>
              </h1>
              <p className="text-xs text-slate-400">Adaptive Auto Data Evaluation &amp; Analytics Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {profile && (
              <button
                onClick={handleDownloadPDF}
                disabled={pdfDownloading}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
              >
                📄 {pdfDownloading ? 'Generating PDF...' : 'Download PDF Report'}
              </button>
            )}
            <button
              onClick={() => setRagOpen(!ragOpen)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5"
            >
              💬 RAG Help Assistant
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <aside className="w-72 bg-slate-900 border-r border-slate-800 p-5 flex flex-col gap-6 overflow-y-auto">
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Dataset Ingestion</h2>
              <label className="block border-2 border-dashed border-slate-700 rounded-xl p-5 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-950/20 transition group">
                <input type="file" accept=".csv,.xlsx,.xls,.json" onChange={handleUpload} className="hidden" />
                <div className="text-2xl mb-1 group-hover:scale-110 transition">📁</div>
                <span className="text-xs text-slate-300 font-medium block">
                  {uploading ? 'Parsing & Profiling...' : 'Upload CSV / Excel / JSON'}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">Auto-generates profiling &amp; alerts</span>
              </label>
              {error && <p className="text-red-400 text-xs mt-2 bg-red-950/50 p-2 rounded border border-red-800">{error}</p>}
            </div>

            {profile && (
              <div className="space-y-4">
                <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">File:</span>
                    <span className="text-slate-200 font-semibold truncate max-w-[140px]" title={filename}>{filename}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rows:</span>
                    <span className="text-slate-200 font-mono">{profile.row_count.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Columns:</span>
                    <span className="text-slate-200 font-mono">{profile.column_count}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Quality Score:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${profile.data_quality_score >= 70 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                      {profile.data_quality_score} / 100
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Available Columns ({allColumns.length})</h3>
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1 text-xs">
                    {allColumns.map(col => {
                      const isNum = numericCols.includes(col);
                      return (
                        <div key={col} className="flex items-center justify-between bg-slate-800/60 px-2.5 py-1 rounded text-slate-300">
                          <span className="truncate max-w-[150px]" title={col}>{col}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${isNum ? 'bg-indigo-950 text-indigo-400' : 'bg-slate-700 text-slate-300'}`}>
                            {isNum ? 'num' : 'str'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </aside>

          {/* Central Workspace */}
          <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
            {!profile ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
                <div className="text-4xl">📊</div>
                <p className="text-sm">Upload a dataset from the left panel to begin analysis.</p>
              </div>
            ) : (
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Tabs */}
                <div className="flex gap-2 border-b border-slate-800 pb-2">
                  {[
                    { id: 'summary', label: 'Overall Summary', icon: '📊' },
                    { id: 'compare', label: 'Comparative Analysis', icon: '⚖️' },
                    { id: 'charts', label: 'Custom Visualizer', icon: '📈' },
                    { id: 'ml', label: 'Machine Learning', icon: '🤖' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-2 ${
                        activeTab === tab.id
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      <span>{tab.icon}</span> {tab.label}
                    </button>
                  ))}
                </div>

                {/* ================= TAB 1: OVERALL SUMMARY ================= */}
                {activeTab === 'summary' && (
                  <div className="space-y-6">
                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <KPICard title="Total Observations" value={profile.row_count.toLocaleString()} badge="Rows" />
                      <KPICard title="Feature Count" value={profile.column_count} badge="Columns" />
                      <KPICard
                        title="Data Quality Health"
                        value={`${profile.data_quality_score}%`}
                        badge={profile.data_quality_score >= 70 ? 'Excellent' : 'Needs Review'}
                        color={profile.data_quality_score >= 70 ? 'emerald' : 'amber'}
                      />
                      <KPICard
                        title="Anomaly Alerts"
                        value={Object.keys(profile.outlier_flags).length}
                        badge="Outlier Columns"
                        color={Object.keys(profile.outlier_flags).length > 0 ? 'amber' : 'emerald'}
                      />
                    </div>

                    {/* Warnings & Alerts Card */}
                    {Object.keys(profile.outlier_flags).length > 0 && (
                      <div className="bg-amber-950/20 border border-amber-900/50 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
                          <span>⚠️</span> Warnings &amp; Anomaly Outliers Flagged
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {Object.entries(profile.outlier_flags).map(([col, alert]) => (
                            <div key={col} className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-semibold text-slate-200 block truncate max-w-[200px]">{col}</span>
                                <span className="text-slate-400">{alert.outlier_count} statistical outlier(s) detected via IQR</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${alert.severity === 'high' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                                {alert.severity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Descriptive Statistics Table */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                      <h3 className="text-sm font-bold text-slate-200">Descriptive Numeric Statistics</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-800 bg-slate-950/50">
                              <th className="py-2.5 px-3">Column Name</th>
                              <th className="py-2.5 px-3">Mean</th>
                              <th className="py-2.5 px-3">Std Dev</th>
                              <th className="py-2.5 px-3">Min</th>
                              <th className="py-2.5 px-3">Max</th>
                              <th className="py-2.5 px-3">Missing %</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {Object.entries(profile.numeric_statistics).map(([col, stats]) => (
                              <tr key={col} className="hover:bg-slate-800/40 text-slate-300">
                                <td className="py-2 px-3 font-semibold text-white truncate max-w-[200px]" title={col}>{col}</td>
                                <td className="py-2 px-3 font-mono">{stats.mean.toLocaleString()}</td>
                                <td className="py-2 px-3 font-mono">{stats.std.toLocaleString()}</td>
                                <td className="py-2 px-3 font-mono">{stats.min.toLocaleString()}</td>
                                <td className="py-2 px-3 font-mono">{stats.max.toLocaleString()}</td>
                                <td className="py-2 px-3 font-mono">
                                  <span className={profile.missing_percentage[col] > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                                    {profile.missing_percentage[col]}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ================= TAB 2: COMPARATIVE ANALYSIS ================= */}
                {activeTab === 'compare' && (
                  <div className="space-y-6">
                    {/* Controls Bar */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-4">
                          <div>
                            <label className="text-xs font-semibold text-slate-400 block mb-1">Grouping Dimension (Category)</label>
                            <select
                              value={groupBy}
                              onChange={e => setGroupBy(e.target.value)}
                              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-64"
                            >
                              {allColumns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="text-xs font-semibold text-slate-300">
                              Select Metrics to Compare (Click to Choose)
                            </label>
                            <span className="text-[11px] text-indigo-400 font-mono">
                              {selectedMetrics.length} selected
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                            {numericCols.map(m => {
                              const isSelected = selectedMetrics.includes(m);
                              return (
                                <button
                                  key={m}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedMetrics(selectedMetrics.filter(x => x !== m));
                                    } else {
                                      setSelectedMetrics([...selectedMetrics, m]);
                                    }
                                  }}
                                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40'
                                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/70'
                                  }`}
                                >
                                  <span>{isSelected ? '✓' : '+'}</span>
                                  <span>{m}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          onClick={handleCompare}
                          disabled={compareLoading || selectedMetrics.length === 0}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition disabled:opacity-40"
                        >
                          {compareLoading ? 'Computing Differentials...' : 'Run Comparative Analysis'}
                        </button>
                      </div>
                    </div>

                    {/* Results Display */}
                    {compareResult && (
                      <div className="space-y-6">
                        {/* Grouped Means Table */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                          <h3 className="text-sm font-bold text-slate-200">Group-Wise Mean Differentials</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="text-slate-400 border-b border-slate-800 bg-slate-950/50">
                                  <th className="py-2.5 px-3">{groupBy}</th>
                                  {selectedMetrics.map(m => (
                                    <th key={m} className="py-2.5 px-3">{m} (Mean)</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60">
                                {compareResult.grouped_means?.map((row: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-800/40 text-slate-300">
                                    <td className="py-2 px-3 font-semibold text-white">{row[groupBy]}</td>
                                    {selectedMetrics.map(m => (
                                      <td key={m} className="py-2 px-3 font-mono">
                                        {typeof row[m] === 'number' ? row[m].toLocaleString(undefined, { maximumFractionDigits: 2 }) : row[m]}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Correlation Matrix */}
                        {compareResult.correlation_matrix && (
                          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                            <h3 className="text-sm font-bold text-slate-200">Pairwise Pearson Correlation Matrix</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left">
                                <thead>
                                  <tr className="text-slate-400 border-b border-slate-800 bg-slate-950/50">
                                    <th className="py-2.5 px-3">Feature</th>
                                    {selectedMetrics.map(m => (
                                      <th key={m} className="py-2.5 px-3">{m}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                  {selectedMetrics.map(rowCol => (
                                    <tr key={rowCol} className="hover:bg-slate-800/40 text-slate-300">
                                      <td className="py-2 px-3 font-semibold text-white">{rowCol}</td>
                                      {selectedMetrics.map(colName => {
                                        const val = compareResult.correlation_matrix[rowCol]?.[colName];
                                        return (
                                          <td key={colName} className="py-2 px-3 font-mono">
                                            <span className={`px-2 py-0.5 rounded font-bold ${
                                              val >= 0.7 ? 'bg-emerald-950 text-emerald-400' :
                                              val >= 0.3 ? 'bg-indigo-950 text-indigo-400' :
                                              val <= -0.3 ? 'bg-amber-950 text-amber-400' : 'text-slate-400'
                                            }`}>
                                              {val !== null && val !== undefined ? val : '-'}
                                            </span>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ================= TAB 3: CUSTOM VISUALIZER ================= */}
                {activeTab === 'charts' && (
                  <div className="space-y-6">
                    {/* Controls Bar */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                      <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-4">
                          <div>
                            <label className="text-xs font-semibold text-slate-400 block mb-1">Chart Type</label>
                            <select
                              value={chartType}
                              onChange={e => setChartType(e.target.value)}
                              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-44"
                            >
                              <option value="bar">Bar Chart</option>
                              <option value="line">Line Chart</option>
                              <option value="scatter">Scatter Plot</option>
                              <option value="pie">Pie Chart</option>
                              <option value="heatmap">Correlation Heatmap</option>
                              <option value="boxplot">Boxplot</option>
                              <option value="violin">Violin Plot</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-400 block mb-1">X-Axis Column</label>
                            <select
                              value={chartX}
                              onChange={e => setChartX(e.target.value)}
                              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-56"
                            >
                              {allColumns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-400 block mb-1">Y-Axis Column (Metric)</label>
                            <select
                              value={chartY}
                              onChange={e => setChartY(e.target.value)}
                              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-56"
                            >
                              <option value="">-- Frequency Count (Univariate) --</option>
                              {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>

                        <button
                          onClick={handleChart}
                          disabled={chartLoading}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
                        >
                          {chartLoading ? 'Rendering Chart...' : 'Generate Visualization'}
                        </button>
                      </div>
                    </div>

                    {/* Chart Results & Auto-Commentary */}
                    {chartResult && (
                      <div className="space-y-4">
                        {/* Auto-generated analytical commentary */}
                        {chartResult.commentary && (
                          <div className="bg-indigo-950/30 border border-indigo-900/50 rounded-xl p-4 flex items-start gap-3 text-xs text-indigo-200">
                            <span className="text-base">💡</span>
                            <div>
                              <span className="font-bold uppercase tracking-wider block text-[10px] text-indigo-400 mb-0.5">Automated Descriptive Commentary</span>
                              <p className="leading-relaxed">{chartResult.commentary}</p>
                            </div>
                          </div>
                        )}

                        {/* Interactive Visual Chart Container */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                              {chartType.toUpperCase()} Visual &bull; {chartX} {chartY ? `vs ${chartY}` : ''}
                            </span>
                            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">Interactive Visual Plot</span>
                          </div>

                          {/* The real rendered Plotly chart element */}
                          <div
                            ref={chartContainerRef}
                            id="plotly-chart-container"
                            className="w-full h-96 rounded-lg overflow-hidden flex items-center justify-center"
                          >
                            <p className="text-xs text-slate-500">Loading interactive chart rendering...</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ================= TAB 4: MACHINE LEARNING ================= */}
                {activeTab === 'ml' && (
                  <div className="space-y-6">
                    {/* Controls Bar */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-4">
                          <div>
                            <label className="text-xs font-semibold text-slate-400 block mb-1">Algorithm Task</label>
                            <select
                              value={mlTask}
                              onChange={e => setMlTask(e.target.value as any)}
                              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-48"
                            >
                              <option value="kmeans">K-Means Clustering</option>
                              <option value="regression">Linear Regression</option>
                            </select>
                          </div>

                          {mlTask === 'regression' && (
                            <div>
                              <label className="text-xs font-semibold text-slate-400 block mb-1">Target Variable (Y / Predict)</label>
                              <select
                                value={mlTarget}
                                onChange={e => setMlTarget(e.target.value)}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-56"
                              >
                                {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="text-xs font-semibold text-slate-300">
                              Feature Columns (Numeric) - Click to Select
                            </label>
                            <span className="text-[11px] text-indigo-400 font-mono">
                              {mlFeatures.length} selected
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                            {numericCols.filter(c => mlTask !== 'regression' || c !== mlTarget).map(m => {
                              const isSelected = mlFeatures.includes(m);
                              return (
                                <button
                                  key={m}
                                  onClick={() => {
                                    if (isSelected) {
                                      setMlFeatures(mlFeatures.filter(x => x !== m));
                                    } else {
                                      setMlFeatures([...mlFeatures, m]);
                                    }
                                  }}
                                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/40'
                                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/70'
                                  }`}
                                >
                                  <span>{isSelected ? '✓' : '+'}</span>
                                  <span>{m}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          onClick={handleML}
                          disabled={mlLoading || mlFeatures.length === 0}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition disabled:opacity-40"
                        >
                          {mlLoading ? 'Training Model...' : `Run ${mlTask === 'kmeans' ? 'Clustering' : 'Regression'}`}
                        </button>
                      </div>
                    </div>

                    {/* ML Results */}
                    {mlResult && (
                      <div className="space-y-6">
                        {/* Regression Results */}
                        {mlTask === 'regression' && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <KPICard title="R² Test Score" value={mlResult.r2_test} badge="Test Evaluation" color={mlResult.r2_test >= 0.7 ? 'emerald' : 'amber'} />
                              <KPICard title="R² Train Score" value={mlResult.r2_train} badge="Train Score" />
                              <KPICard title="Mean Squared Error" value={mlResult.mse_test?.toLocaleString()} badge="Test MSE" />
                              <KPICard title="Train / Test Split" value={`${mlResult.n_train} / ${mlResult.n_test}`} badge="Samples" />
                            </div>

                            {/* Coefficients Table */}
                            {mlResult.coefficients && (
                              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                                <h3 className="text-sm font-bold text-slate-200">Learned Feature Weights (Coefficients)</h3>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs text-left">
                                    <thead>
                                      <tr className="text-slate-400 border-b border-slate-800 bg-slate-950/50">
                                        <th className="py-2.5 px-3">Predictor Feature</th>
                                        <th className="py-2.5 px-3">Standardized Weight</th>
                                        <th className="py-2.5 px-3">Impact Direction</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                      {Object.entries(mlResult.coefficients).map(([feat, coef]: [string, any]) => (
                                        <tr key={feat} className="hover:bg-slate-800/40 text-slate-300">
                                          <td className="py-2 px-3 font-semibold text-white">{feat}</td>
                                          <td className="py-2 px-3 font-mono">{coef}</td>
                                          <td className="py-2 px-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${coef >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                                              {coef >= 0 ? 'Positive Impact (↑)' : 'Negative Impact (↓)'}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* K-Means Results */}
                        {mlTask === 'kmeans' && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <KPICard title="Number of Clusters" value={mlResult.k} badge="K Setting" />
                              <KPICard title="Clustered Records" value={mlResult.n_samples?.toLocaleString()} badge="Dataset Size" />
                              <KPICard title="Features Modeled" value={mlResult.columns_used?.length} badge="Dimensions" />
                            </div>

                            {/* Centroids Table */}
                            {mlResult.centroids && (
                              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                                <h3 className="text-sm font-bold text-slate-200">Cluster Centers (Centroids)</h3>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs text-left">
                                    <thead>
                                      <tr className="text-slate-400 border-b border-slate-800 bg-slate-950/50">
                                        <th className="py-2.5 px-3">Cluster ID</th>
                                        {mlResult.columns_used?.map((col: string) => (
                                          <th key={col} className="py-2.5 px-3">{col}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                      {mlResult.centroids.map((center: number[], idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-800/40 text-slate-300">
                                          <td className="py-2 px-3 font-semibold text-indigo-400">Cluster #{idx + 1}</td>
                                          {center.map((val, cIdx) => (
                                            <td key={cIdx} className="py-2 px-3 font-mono">{roundNum(val)}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </main>

          {/* RAG Help Slide-Over Drawer */}
          {ragOpen && (
            <aside className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col z-30 shadow-2xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">💬</span>
                  <h2 className="font-bold text-sm text-white">RAG Insight Assistant</h2>
                </div>
                <button onClick={() => setRagOpen(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {ragResponse ? (
                  <div className="space-y-3">
                    <RAGBlock title="Plain-Language Explanation" color="indigo">{ragResponse.explanation}</RAGBlock>
                    <RAGBlock title="Root-Cause Analysis" color="amber">{ragResponse.root_cause}</RAGBlock>
                    <RAGBlock title="Strategic Counter-Plan" color="emerald">{ragResponse.counter_plan}</RAGBlock>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                      <span className="px-2 py-0.5 rounded font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                        {ragResponse.confidence} Confidence
                      </span>
                      <span>Evidence: {ragResponse.citations.join(', ')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 text-center py-10">
                    Ask a question about anomalies, performance gaps, or metric root-causes in your dataset.
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-800">
                <div className="flex gap-2">
                  <input
                    value={ragQuestion}
                    onChange={e => setRagQuestion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRag()}
                    placeholder="e.g. Why are certain metrics skewed?"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleRag}
                    disabled={ragLoading}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
                  >
                    {ragLoading ? '...' : 'Ask'}
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

// ---- Helper Components ----

function KPICard({ title, value, badge, color = 'indigo' }: { title: string; value: string | number; badge?: string; color?: string }) {
  const textColor = color === 'emerald' ? 'text-emerald-400' : color === 'amber' ? 'text-amber-400' : 'text-indigo-400';
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        {badge && <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">{badge}</span>}
      </div>
      <div className={`text-2xl font-bold mt-2 font-mono ${textColor}`}>{value}</div>
    </div>
  );
}

function RAGBlock({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const border = color === 'indigo' ? 'border-indigo-600' : color === 'amber' ? 'border-amber-600' : 'border-emerald-600';
  const tagBg = color === 'indigo' ? 'bg-indigo-950 text-indigo-400' : color === 'amber' ? 'bg-amber-950 text-amber-400' : 'bg-emerald-950 text-emerald-400';
  return (
    <div className={`border-l-4 ${border} bg-slate-800/40 rounded-r-xl p-3.5 space-y-1`}>
      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${tagBg}`}>
        {title}
      </span>
      <p className="text-xs text-slate-300 leading-relaxed pt-1">{children}</p>
    </div>
  );
}

function roundNum(val: any): string {
  if (typeof val === 'number') {
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(val);
}
