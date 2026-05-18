import React, { useState } from 'react';
import { Gift, Zap, TrendingUp, Star, Trophy, Award } from 'lucide-react';

export default function LoyaltyProgram() {
  const [tiers] = useState([
    { name: 'Bronze', minPoints: 0, bonus: '1%', perks: ['5% discount', 'Birthday bonus'] },
    { name: 'Silver', minPoints: 500, bonus: '1.5%', perks: ['10% discount', 'Free delivery', 'Early access'] },
    { name: 'Gold', minPoints: 2000, bonus: '2%', perks: ['15% discount', 'Free delivery', 'Priority support'] },
    { name: 'Platinum', minPoints: 5000, bonus: '3%', perks: ['20% discount', 'Free everything', 'VIP support'] },
  ]);

  const [events] = useState([
    { id: 1, name: 'Order Complete', points: 10, multiplier: '1x' },
    { id: 2, name: 'Write Review', points: 50, multiplier: '1x' },
    { id: 3, name: 'Refer Friend', points: 200, multiplier: '1x' },
    { id: 4, name: 'Weekly Challenge', points: 100, multiplier: '2x' },
  ]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Loyalty & Gamification</h1>
          <p className="text-gray-600 mt-2">Reward engaged customers and drive retention with points, tiers, and challenges</p>
        </div>

        {/* Membership Tiers */}
        <div>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-orange-600" />
            Membership Tiers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {tiers.map((tier, idx) => (
              <div key={idx} className={`rounded-lg p-6 border-2 ${
                idx === 3 ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300' :
                idx === 2 ? 'bg-gradient-to-br from-orange-50 to-red-50 border-orange-300' :
                idx === 1 ? 'bg-gradient-to-br from-gray-50 to-blue-50 border-gray-300' :
                'bg-white border-gray-200'
              }`}>
                <p className="text-lg font-bold mb-2">{tier.name}</p>
                <p className="text-sm text-gray-600 mb-3">{tier.minPoints}+ points</p>
                <p className="text-2xl font-bold text-orange-600 mb-4">{tier.bonus} cashback</p>
                <ul className="text-sm space-y-1">
                  {tier.perks.map((perk, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-orange-600">✓</span> {perk}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Point Events */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center gap-2">
            <Zap className="w-6 h-6 text-orange-600" />
            <h2 className="text-xl font-bold">Point Events & Multipliers</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {events.map(event => (
              <div key={event.id} className="p-6 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-bold text-gray-900">{event.name}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-orange-600">{event.points}</p>
                    <p className="text-xs text-gray-600">points</p>
                  </div>
                  <div className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold text-sm">
                    {event.multiplier}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gamification Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Award className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-bold">Badges & Achievements</h3>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="font-bold text-purple-900">🎯 Order Streak</p>
                <p className="text-sm text-purple-700">5+ orders in 2 weeks</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-bold text-blue-900">⭐ Review Master</p>
                <p className="text-sm text-blue-700">10+ helpful reviews</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="font-bold text-green-900">🚀 Speed Eater</p>
                <p className="text-sm text-green-700">3 orders in same day</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Gift className="w-6 h-6 text-pink-600" />
              <h3 className="text-lg font-bold">Weekly Challenges</h3>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-pink-50 rounded-lg">
                <p className="font-bold text-pink-900">🌮 Taco Tuesday</p>
                <p className="text-sm text-pink-700">Order any taco - 100 bonus points</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="font-bold text-orange-900">🍱 Lunch Special</p>
                <p className="text-sm text-orange-700">Order 12pm-2pm - 50 bonus points</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="font-bold text-yellow-900">🤝 Refer a Friend</p>
                <p className="text-sm text-yellow-700">Both get 200 bonus points</p>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-600 text-sm font-medium">Active Members</p>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold">8,542</p>
            <p className="text-xs text-gray-600 mt-2">+12% this month</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-600 text-sm font-medium">Points Redeemed</p>
              <Star className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold">245,820</p>
            <p className="text-xs text-gray-600 mt-2">Worth 24,582₣</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-600 text-sm font-medium">Retention Rate</p>
              <Award className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold">87.3%</p>
            <p className="text-xs text-gray-600 mt-2">+5% vs non-members</p>
          </div>
        </div>
      </div>
    </div>
  );
}
