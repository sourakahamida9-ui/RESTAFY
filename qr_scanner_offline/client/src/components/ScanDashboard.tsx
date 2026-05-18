import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Wifi, WifiOff, Clock, CheckCircle2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface ScanStats {
  totalScans: number;
  validScans: number;
  duplicateScans: number;
  invalidScans: number;
  avgScanTimeMs: number;
  scanPercentage: number;
}

interface ScanDashboardProps {
  eventId: number;
  isOnline: boolean;
  pendingScans: number;
}

/**
 * Dashboard component displaying real-time scan statistics
 */
export function ScanDashboard({ eventId, isOnline, pendingScans }: ScanDashboardProps) {
  const [stats, setStats] = useState<ScanStats>({
    totalScans: 0,
    validScans: 0,
    duplicateScans: 0,
    invalidScans: 0,
    avgScanTimeMs: 0,
    scanPercentage: 0,
  });

  const scanHistory = trpc.scan.getHistory.useQuery({ eventId, limit: 50 });

  // Simulate real-time stats update
  useEffect(() => {
    const interval = setInterval(() => {
      scanHistory.refetch();
    }, 5000);

    return () => clearInterval(interval);
  }, [scanHistory]);

  // Calculate stats from scan history
  useEffect(() => {
    if (scanHistory.data) {
      const totalScans = scanHistory.data.length;
      setStats(prev => ({
        ...prev,
        totalScans,
      }));
    }
  }, [scanHistory.data]);

  const chartData = [
    { name: 'Valides', value: stats.validScans, fill: '#10b981' },
    { name: 'Doublons', value: stats.duplicateScans, fill: '#f59e0b' },
    { name: 'Invalides', value: stats.invalidScans, fill: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Scans */}
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Total scannés</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">{stats.totalScans}</p>
            </div>
            <div className="w-12 h-12 bg-blue-200 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        {/* Scan Percentage */}
        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Taux de remplissage</p>
              <p className="text-3xl font-bold text-green-900 mt-1">{stats.scanPercentage}%</p>
            </div>
            <div className="w-12 h-12 bg-green-200 rounded-lg flex items-center justify-center">
              <span className="text-lg font-bold text-green-600">✓</span>
            </div>
          </div>
        </Card>

        {/* Avg Scan Time */}
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Temps moyen</p>
              <p className="text-3xl font-bold text-purple-900 mt-1">{stats.avgScanTimeMs}ms</p>
            </div>
            <div className="w-12 h-12 bg-purple-200 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>

        {/* Connection Status */}
        <Card className={`p-4 bg-gradient-to-br border-2 ${
          isOnline
            ? 'from-green-50 to-green-100 border-green-200'
            : 'from-orange-50 to-orange-100 border-orange-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${
                isOnline ? 'text-green-600' : 'text-orange-600'
              }`}>
                Connexion
              </p>
              <p className={`text-lg font-bold mt-1 ${
                isOnline ? 'text-green-900' : 'text-orange-900'
              }`}>
                {isOnline ? 'En ligne' : 'Hors-ligne'}
              </p>
              {pendingScans > 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  {pendingScans} en attente
                </p>
              )}
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              isOnline ? 'bg-green-200' : 'bg-orange-200'
            }`}>
              {isOnline ? (
                <Wifi className="w-6 h-6 text-green-600" />
              ) : (
                <WifiOff className="w-6 h-6 text-orange-600" />
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scan Distribution Pie Chart */}
        <Card className="p-4">
          <h3 className="font-semibold text-lg mb-4">Distribution des scans</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Scan Timeline */}
        <Card className="p-4">
          <h3 className="font-semibold text-lg mb-4">Historique des scans</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {scanHistory.data && scanHistory.data.length > 0 ? (
              scanHistory.data.slice(0, 10).map((scan, index) => (
                <div key={scan.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-green-600">{index + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Scan #{index + 1}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(scan.scannedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Aucun scan pour le moment</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
