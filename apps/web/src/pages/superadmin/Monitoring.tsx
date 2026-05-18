import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const SERVICES = [
  { name: 'Next.js / Vite App',      status: 'up',   latency: 142, uptime: '99.98%' },
  { name: 'Supabase Database',        status: 'up',   latency: 38,  uptime: '99.99%' },
  { name: 'Supabase Auth',            status: 'up',   latency: 52,  uptime: '99.97%' },
  { name: 'Supabase Realtime',        status: 'up',   latency: 18,  uptime: '99.95%' },
  { name: 'Supabase Storage',         status: 'up',   latency: 210, uptime: '99.90%' },
  { name: 'Gemini API',               status: 'up',   latency: 680, uptime: '99.50%' },
  { name: 'Brevo (Email)',            status: 'up',   latency: 320, uptime: '99.80%' },
  { name: 'Firebase FCM (Push)',      status: 'degraded', latency: 1200, uptime: '98.50%' },
];

const genLatencyData = () => Array.from({ length: 20 }, (_, i) => ({
  t: i,
  db: Math.floor(30 + Math.random() * 20),
  api: Math.floor(120 + Math.random() * 60),
}));

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'up') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === 'degraded') return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  return <XCircle className="w-4 h-4 text-red-400" />;
};

export default function SuperAdminMonitoring() {
  const [data, setData] = useState(genLatencyData());
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => {
      setData(prev => [...prev.slice(1), { t: prev[prev.length - 1].t + 1, db: Math.floor(30 + Math.random() * 20), api: Math.floor(120 + Math.random() * 60) }]);
      setLastRefresh(new Date());
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black">Monitoring</h2>
          <p className="text-zinc-500 text-sm flex items-center gap-2">
            <RefreshCw className="w-3 h-3" /> Mis à jour {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-sm font-bold">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          Tous systèmes opérationnels
        </div>
      </div>

      {/* Services */}
      <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="font-bold">État des services</h3>
        </div>
        <div className="divide-y divide-white/5">
          {SERVICES.map(s => (
            <div key={s.name} className="flex items-center px-6 py-4 gap-4">
              <StatusIcon status={s.status} />
              <div className="flex-1">
                <p className="text-sm font-bold">{s.name}</p>
                <p className="text-[10px] text-zinc-500">Uptime: {s.uptime}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${s.latency > 1000 ? 'text-amber-400' : s.latency > 500 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                  {s.latency}ms
                </p>
                <p className="text-[10px] text-zinc-500">latence</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live latency chart */}
      <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Latence en direct
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
            <XAxis dataKey="t" hide />
            <YAxis tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} unit="ms" />
            <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, color: '#fff' }} />
            <Line type="monotone" dataKey="db" stroke="#22C55E" strokeWidth={2} dot={false} name="DB" />
            <Line type="monotone" dataKey="api" stroke="#FF6B00" strokeWidth={2} dot={false} name="API" />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-6 mt-3 text-xs">
          <span className="flex items-center gap-2 text-zinc-400"><span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Base de données</span>
          <span className="flex items-center gap-2 text-zinc-400"><span className="w-3 h-0.5 bg-primary inline-block" /> API App</span>
        </div>
      </div>
    </div>
  );
}
