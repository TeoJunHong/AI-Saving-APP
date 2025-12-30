
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Plus, 
  History as HistoryIcon, 
  PieChart, 
  Wallet, 
  User, 
  Mic, 
  X, 
  Send,
  Zap,
  TrendingDown,
  TrendingUp,
  Award,
  Flame,
  CheckCircle2,
  Calendar,
  ChevronRight,
  Check,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  BarChart3,
  Edit3,
  Repeat,
  Target,
  ArrowRight,
  RefreshCcw,
  Clock,
  Layers,
  Activity,
  Calculator,
  TrendingUp as TrendUpIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  format, 
  subDays, 
  isSameDay, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval, 
  subMonths,
  isSameMonth,
  isSameYear,
  differenceInDays,
  startOfToday,
  endOfToday,
  startOfYesterday,
  eachDayOfInterval,
  startOfDay
} from 'date-fns';
import { Expense, Category, Budget, UserStats, AIInsight } from './types';
import { parseExpenseInput, getSmartInsights } from './services/geminiService';

// --- Constants & Helper for Mock Data ---

const DEFAULT_CATEGORIES: Category[] = [
  'Food & Drink', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Utilities', 'Groceries', 'Salary', 'Freelance', 'Other'
];

const generateMockData = (): Expense[] => {
  const data: Expense[] = [];
  const today = new Date();
  
  // Generate data for the last 90 days
  for (let i = 0; i < 95; i++) {
    const d = subDays(today, i);
    const dateStr = d.toISOString();
    const dayOfMonth = d.getDate();

    // 1. Monthly Salary (Fixed Income)
    if (dayOfMonth === 1) {
      data.push({
        id: `inc-sal-${i}`,
        amount: 6500,
        currency: 'RM',
        category: 'Salary',
        merchant: 'Tech Global Corp',
        note: 'Monthly Payroll',
        date: dateStr,
        type: 'income',
        isFixed: true
      });
      // Rent (Fixed Expense)
      data.push({
        id: `exp-rent-${i}`,
        amount: 1800,
        currency: 'RM',
        category: 'Other',
        merchant: 'Condo Mgmt',
        note: 'Rental',
        date: dateStr,
        type: 'expense',
        isFixed: true
      });
    }

    // 2. Weekly Groceries (Variable but consistent)
    if (d.getDay() === 0) { // Sundays
      data.push({
        id: `exp-groc-${i}`,
        amount: Math.floor(Math.random() * 100) + 150,
        currency: 'RM',
        category: 'Groceries',
        merchant: 'Village Grocer',
        note: 'Weekly stock',
        date: dateStr,
        type: 'expense',
        isFixed: false
      });
    }

    // 3. Mid-month Utilities (Fixed)
    if (dayOfMonth === 15) {
      data.push({
        id: `exp-util-${i}`,
        amount: 220,
        currency: 'RM',
        category: 'Utilities',
        merchant: 'TNB/Syabas',
        note: 'Water & Electric',
        date: dateStr,
        type: 'expense',
        isFixed: true
      });
    }

    // 4. Daily Food (Variable)
    const foodItems = Math.floor(Math.random() * 3);
    for (let j = 0; j < foodItems; j++) {
      data.push({
        id: `exp-food-${i}-${j}`,
        amount: Math.floor(Math.random() * 40) + 10,
        currency: 'RM',
        category: 'Food & Drink',
        merchant: ['GrabFood', 'Starbucks', 'Nasi Lemak Stall', 'Mamak'][Math.floor(Math.random() * 4)],
        note: 'Meal',
        date: dateStr,
        type: 'expense',
        isFixed: false
      });
    }

    // 5. Random Freelance income (Occasional)
    if (Math.random() > 0.95) {
      data.push({
        id: `inc-free-${i}`,
        amount: Math.floor(Math.random() * 500) + 200,
        currency: 'RM',
        category: 'Freelance',
        merchant: 'Upwork Client',
        note: 'Project Bonus',
        date: dateStr,
        type: 'income',
        isFixed: false
      });
    }
  }
  return data;
};

const MOCK_STATS: UserStats = {
  streak: 24,
  xp: 4850,
  level: 32,
  lastActiveDate: new Date().toISOString(),
  badges: ['Early Bird', 'Saver', 'Income Booster', 'Quarterly Master']
};

// --- Components ---

const Header: React.FC<{ stats: UserStats }> = ({ stats }) => (
  <header className="px-6 pt-8 pb-4 flex justify-between items-center relative z-20">
    <div>
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Wealth Track 🚀</h1>
      <p className="text-sm text-slate-500 font-medium">Business-grade monitoring.</p>
    </div>
    <div className="flex items-center space-x-4">
      <div className="bg-orange-100 px-3 py-1.5 rounded-full flex items-center space-x-1 border border-orange-200">
        <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
        <span className="text-sm font-bold text-orange-700">{stats.streak}d</span>
      </div>
      <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-md overflow-hidden">
        <img src="https://picsum.photos/seed/userwealth/100/100" alt="Avatar" />
      </div>
    </div>
  </header>
);

const TransactionModal: React.FC<{
  item: Partial<Expense>;
  existingCategories: Category[];
  onConfirm: (final: Expense) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
}> = ({ item, existingCategories, onConfirm, onCancel, onDelete }) => {
  const isEdit = !!item.id;
  const [formData, setFormData] = useState({
    amount: item.amount || 0,
    currency: item.currency || 'RM',
    merchant: item.merchant || '',
    category: (item.category as Category) || 'Other',
    date: item.date ? item.date.split('T')[0] : format(new Date(), 'yyyy-MM-dd'),
    note: item.note || '',
    type: item.type || 'expense',
    isFixed: item.isFixed || false
  });

  const [isCustomCategory, setIsCustomCategory] = useState(!DEFAULT_CATEGORIES.includes(formData.category) && formData.category !== '');
  const [customCatInput, setCustomCatInput] = useState(isCustomCategory ? formData.category : '');

  const handleCategorySelect = (cat: Category) => {
    setFormData({ ...formData, category: cat });
    setIsCustomCategory(false);
  };

  const handleCustomCatChange = (val: string) => {
    setCustomCatInput(val);
    setFormData({ ...formData, category: val });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl relative"
      >
        <button onClick={onCancel} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors"><X className="w-6 h-6" /></button>

        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-900">{isEdit ? 'Edit Transaction' : 'Confirm Entry'}</h3>
          {isEdit && onDelete && (
            <button onClick={() => onDelete(item.id!)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 className="w-5 h-5" /></button>
          )}
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
          <button 
            onClick={() => setFormData({...formData, type: 'expense'})}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${formData.type === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}
          >Expense</button>
          <button 
            onClick={() => setFormData({...formData, type: 'income'})}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${formData.type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
          >Income</button>
        </div>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar pb-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Amount</label>
              <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="font-bold text-slate-400">{formData.currency}</span>
                <input 
                  type="number" value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="bg-transparent font-bold text-xl text-slate-800 outline-none w-full"
                />
              </div>
            </div>
          </div>

          <div className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${formData.isFixed ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center space-x-3">
              <RefreshCcw className={`w-5 h-5 ${formData.isFixed ? 'text-white' : 'text-slate-400'}`} />
              <div>
                <p className={`text-sm font-black tracking-tight ${formData.isFixed ? 'text-white' : 'text-slate-700'}`}>Recurring / Fixed</p>
                <p className={`text-[10px] font-bold uppercase ${formData.isFixed ? 'text-white/60' : 'text-slate-400'}`}>Salary, Rent, Subs</p>
              </div>
            </div>
            <button 
              onClick={() => setFormData({...formData, isFixed: !formData.isFixed})}
              className={`w-14 h-7 rounded-full transition-colors relative flex items-center px-1 ${formData.isFixed ? 'bg-white' : 'bg-slate-300'}`}
            >
              <motion.div 
                animate={{ x: formData.isFixed ? 28 : 0 }}
                className={`w-5 h-5 rounded-full shadow-md ${formData.isFixed ? 'bg-indigo-600' : 'bg-white'}`}
              />
            </button>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Merchant / Source</label>
            <input 
              type="text" value={formData.merchant}
              onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
              className="w-full bg-slate-50 p-3 rounded-2xl border border-slate-100 font-bold text-slate-800 outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Date</label>
            <input 
              type="date" value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full bg-slate-50 p-3 rounded-2xl border border-slate-100 font-bold text-slate-800 outline-none cursor-pointer"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {existingCategories.slice(0, 7).map((cat) => (
                <button
                  key={cat} onClick={() => handleCategorySelect(cat)}
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl border text-sm font-bold transition-all ${formData.category === cat && !isCustomCategory ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-500'}`}
                >
                  <span className="truncate">{cat}</span> {formData.category === cat && !isCustomCategory && <Check className="w-4 h-4" />}
                </button>
              ))}
              <button
                onClick={() => setIsCustomCategory(true)}
                className={`flex items-center justify-between px-4 py-3 rounded-2xl border text-sm font-bold transition-all ${isCustomCategory ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-500'}`}
              >
                <span>Custom</span> <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <button 
          onClick={() => onConfirm({ id: item.id || Math.random().toString(36).substr(2, 9), ...formData } as Expense)}
          className={`w-full py-4 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center space-x-2 text-white mt-6 ${formData.type === 'income' ? 'bg-emerald-600 shadow-emerald-100' : 'bg-rose-600 shadow-rose-100'}`}
        >
          <span>Confirm {formData.type}</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </motion.div>
    </motion.div>
  );
};

const TransactionCard: React.FC<{ item: Expense; onClick: () => void }> = ({ item, onClick }) => {
  const isIncome = item.type === 'income';
  return (
    <motion.div 
      layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }} onClick={onClick}
      className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between mb-3 shadow-sm hover:shadow-md cursor-pointer group"
    >
      <div className="flex items-center space-x-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg transition-colors ${isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {isIncome ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h4 className="font-bold text-slate-800 line-clamp-1">{item.merchant || 'Untitled'}</h4>
            {item.isFixed && <RefreshCcw className="w-3 h-3 text-indigo-500" />}
          </div>
          <div className="flex items-center space-x-2 mt-0.5">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{item.category}</p>
            {item.isFixed && (
              <span className="text-[8px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Recurring</span>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className={`font-bold text-lg ${isIncome ? 'text-emerald-600' : 'text-slate-900'}`}>{isIncome ? '+' : '-'}{item.amount.toLocaleString()} <span className="text-[10px] ml-0.5">{item.currency}</span></p>
      </div>
    </motion.div>
  );
};

const SpendingChart: React.FC<{ expenses: Expense[], startDate: string, endDate: string }> = ({ expenses, startDate, endDate }) => {
  const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });
  
  const dailyData = days.map(d => {
    const total = expenses
      .filter(e => e.type === 'expense' && isSameDay(parseISO(e.date), d))
      .reduce((sum, e) => sum + e.amount, 0);
    return total;
  });

  const max = Math.max(...dailyData, 1);
  const chartHeight = 120;
  const chartWidth = 300;
  const step = chartWidth / (dailyData.length - 1 || 1);

  const points = dailyData.map((val, i) => `${i * step},${chartHeight - (val / max) * chartHeight}`).join(' ');
  const areaPoints = `${points} ${chartWidth},${chartHeight} 0,${chartHeight}`;

  return (
    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm mt-5">
      <div className="flex items-center justify-between mb-6">
        <h4 className="font-bold text-slate-800">Expense Trend</h4>
        <div className="flex items-center space-x-1">
          <TrendUpIcon className="w-3 h-3 text-rose-500" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Daily Outflow</span>
        </div>
      </div>
      
      <div className="relative h-[120px] w-full">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`M 0,${chartHeight} L ${areaPoints}`} fill="url(#areaGradient)" />
          <polyline points={points} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      
      <div className="flex justify-between mt-4">
        <span className="text-[9px] font-black text-slate-400 uppercase">{format(days[0], 'MMM d')}</span>
        <span className="text-[9px] font-black text-slate-400 uppercase">{format(days[days.length-1], 'MMM d')}</span>
      </div>
    </div>
  );
};

const TabNavigation: React.FC<{ active: string; onChange: (tab: string) => void }> = ({ active, onChange }) => {
  const tabs = [
    { id: 'home', icon: Wallet },
    { id: 'history', icon: HistoryIcon },
    { id: 'insights', icon: BarChart3 },
    { id: 'profile', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 px-6 py-4 flex justify-around items-center z-50 max-w-md mx-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`p-2 rounded-xl transition-all ${active === tab.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Icon className="w-6 h-6" />
          </button>
        );
      })}
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stats, setStats] = useState<UserStats>(MOCK_STATS);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingItem, setPendingItem] = useState<Partial<Expense> | null>(null);
  
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showRangePicker, setShowRangePicker] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('spendwise_data_v7');
    if (saved) {
      const parsed = JSON.parse(saved);
      setExpenses(parsed.expenses || []);
      setStats(parsed.stats || MOCK_STATS);
    } else {
      setExpenses(generateMockData());
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('spendwise_data_v7', JSON.stringify({ expenses, stats }));
  }, [expenses, stats]);

  const userCategories = useMemo(() => {
    const fromHistory = expenses.map(e => e.category);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromHistory])).filter(Boolean);
  }, [expenses]);

  const financialData = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const interval = { start, end };
    
    const periodTransactions = expenses.filter(e => {
      const d = parseISO(e.date);
      return isWithinInterval(d, interval);
    });
    
    const income = periodTransactions.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const expenseTotal = periodTransactions.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const net = income - expenseTotal;
    
    const daysInPeriod = Math.max(1, differenceInDays(end, start) + 1);
    const avgDaily = expenseTotal / daysInPeriod;

    const savingRate = income > 0 ? Math.round((net / income) * 100) : 0;

    const fixedTotal = periodTransactions.filter(e => e.type === 'expense' && e.isFixed).reduce((s, e) => s + e.amount, 0);
    const variableTotal = expenseTotal - fixedTotal;

    const categoryMap: Record<string, number> = {};
    periodTransactions.filter(e => e.type === 'expense').forEach(e => {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
    });
    const topCategories = Object.entries(categoryMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);

    let health: 'green' | 'yellow' | 'red' = 'green';
    const expenseRatio = income > 0 ? expenseTotal / income : expenseTotal > 0 ? 1.2 : 0;
    if (expenseRatio > 0.9) health = 'red';
    else if (expenseRatio > 0.7) health = 'yellow';

    return { income, expenseTotal, net, avgDaily, savingRate, fixedTotal, variableTotal, topCategories, health };
  }, [expenses, startDate, endDate]);

  const groupedTransactions = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const interval = { start, end };

    const filtered = expenses
      .filter(e => isWithinInterval(parseISO(e.date), interval))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const groups: { [key: string]: { items: Expense[], totalExpense: number, totalIncome: number } } = {};
    filtered.forEach(t => {
      const dateStr = format(parseISO(t.date), 'yyyy-MM-dd');
      if (!groups[dateStr]) groups[dateStr] = { items: [], totalExpense: 0, totalIncome: 0 };
      groups[dateStr].items.push(t);
      if (t.type === 'expense') groups[dateStr].totalExpense += t.amount;
      else groups[dateStr].totalIncome += t.amount;
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [expenses, startDate, endDate]);

  const handleAddTransaction = async (input: string) => {
    setIsLoading(true);
    const parsed = await parseExpenseInput(input);
    if (parsed.amount) {
      setPendingItem(parsed);
    }
    setIsLoading(false);
  };

  const confirmTransaction = (final: Expense) => {
    setExpenses(prev => {
      const exists = prev.find(e => e.id === final.id);
      if (exists) return prev.map(e => e.id === final.id ? final : e);
      return [final, ...prev];
    });
    setPendingItem(null);
  };

  const renderRangePicker = () => (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-xl mb-6 overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adjust View Scope</h4>
        <button onClick={() => { setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd')); setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd')); setShowRangePicker(false); }} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl">Current Month</button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-xs font-bold outline-none" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-xs font-bold outline-none" />
        </div>
      </div>
    </motion.div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="pb-24">
            <div className="px-6 py-4">
              <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5"><Calculator className="w-40 h-40" /></div>
                <div className="flex justify-between items-start mb-2">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Net Balance (Selected Range)</p>
                  <div className={`px-2.5 py-1 rounded-full text-[9px] font-black border tracking-tighter uppercase ${financialData.health === 'green' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : financialData.health === 'yellow' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                    {financialData.health === 'green' ? 'Healthy' : financialData.health === 'yellow' ? 'Borderline' : 'At Risk'}
                  </div>
                </div>
                <h3 className={`text-4xl font-bold mb-8 ${financialData.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  RM{financialData.net.toLocaleString()}
                </h3>
                <div className="flex space-x-4">
                  <div className="flex-1 bg-white/5 p-4 rounded-3xl border border-white/10">
                    <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Incoming</p>
                    <p className="text-sm font-black text-emerald-400">+RM{financialData.income.toLocaleString()}</p>
                  </div>
                  <div className="flex-1 bg-white/5 p-4 rounded-3xl border border-white/10">
                    <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Outgoing</p>
                    <p className="text-sm font-black text-rose-400">-RM{financialData.expenseTotal.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 mt-4">
              <form onSubmit={(e) => { e.preventDefault(); handleAddTransaction((e.target as any).input.value); (e.target as any).reset(); }} className="relative group">
                <input name="input" placeholder="Lunch RM25 yesterday" className="w-full bg-white border border-slate-200 rounded-[24px] py-5 pl-7 pr-14 text-sm font-semibold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none shadow-sm transition-all" />
                <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 bg-indigo-600 text-white p-2.5 rounded-2xl hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200"><Send className="w-5 h-5" /></button>
              </form>
            </div>

            <div className="px-6 mt-10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-slate-800 uppercase tracking-widest text-[11px] flex items-center"><Activity className="w-4 h-4 mr-2 text-indigo-500" /> Recent Activity</h3>
                <button onClick={() => setActiveTab('history')} className="text-xs font-bold text-indigo-600 flex items-center">View Timeline <ArrowRight className="w-3 h-3 ml-1" /></button>
              </div>
              <AnimatePresence mode="popLayout">
                {isLoading ? (
                  <div className="text-center py-12 flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">AI Parsing...</p>
                  </div>
                ) : (
                  expenses.slice(0, 5).map(t => <TransactionCard key={t.id} item={t} onClick={() => setPendingItem(t)} />)
                )}
              </AnimatePresence>
            </div>
          </div>
        );

      case 'history':
        return (
          <div className="px-6 pb-24">
            <div className="flex flex-col mb-4 sticky top-0 bg-slate-50/90 backdrop-blur-md pt-4 z-20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold tracking-tight">Timeline</h2>
                <button onClick={() => setShowRangePicker(!showRangePicker)} className={`p-2.5 rounded-xl border transition-all flex items-center space-x-2 ${showRangePicker ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-200 shadow-lg' : 'bg-white border-slate-200 text-slate-600 shadow-sm'}`}>
                  <Filter className="w-5 h-5" />
                  <span className="text-xs font-bold">{showRangePicker ? 'Applying' : 'Filter Scope'}</span>
                </button>
              </div>
              <AnimatePresence>{showRangePicker && renderRangePicker()}</AnimatePresence>
              {!showRangePicker && (
                <div className="flex items-center space-x-2 mb-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <p className="text-[11px] font-bold text-slate-600">{format(parseISO(startDate), 'MMM d')} — {format(parseISO(endDate), 'MMM d, yyyy')}</p>
                </div>
              )}
            </div>

            <div className="space-y-10">
              {groupedTransactions.length > 0 ? (
                groupedTransactions.map(([date, data]) => (
                  <div key={date} className="relative">
                    <div className="flex items-center justify-between mb-5 sticky top-[140px] bg-slate-50/95 py-2 z-10 border-b border-slate-200/50">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                          <span className="text-[8px] font-black uppercase text-slate-400 leading-none">{format(parseISO(date), 'MMM')}</span>
                          <span className="text-sm font-black text-slate-800">{format(parseISO(date), 'd')}</span>
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{format(parseISO(date), 'EEEE')}</p>
                          <p className="text-[10px] font-bold text-indigo-600/70">{data.items.length} Transactions</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Net Total</p>
                        <p className={`text-sm font-black ${data.totalIncome - data.totalExpense >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {data.totalIncome - data.totalExpense >= 0 ? '+' : ''}RM{(data.totalIncome - data.totalExpense).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1 pl-2 border-l-2 border-slate-100 ml-5">
                      {data.items.map(t => <TransactionCard key={t.id} item={t} onClick={() => setPendingItem(t)} />)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-20 bg-white rounded-[32px] border-2 border-dashed border-slate-100">
                  <p className="text-slate-400 text-sm font-bold">No entries found for this scope.</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'insights':
        return (
          <div className="px-6 pb-24">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold tracking-tight">Business Health</h2>
              <button onClick={() => setShowRangePicker(!showRangePicker)} className="flex items-center space-x-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <span className="text-[10px] font-black text-slate-700 uppercase">{format(parseISO(startDate), 'MMM d')} - {format(parseISO(endDate), 'MMM d')}</span>
              </button>
            </div>

            <AnimatePresence>{showRangePicker && renderRangePicker()}</AnimatePresence>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
                  <div className={`absolute top-0 right-0 w-2 h-full ${financialData.health === 'green' ? 'bg-emerald-400' : financialData.health === 'yellow' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                  <Target className="w-6 h-6 text-indigo-600 mb-4" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Daily Spend</p>
                  <p className="text-2xl font-bold text-slate-900">RM{Math.round(financialData.avgDaily).toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                  <Zap className="w-6 h-6 text-amber-500 mb-4" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Saving Rate</p>
                  <p className="text-2xl font-bold text-slate-900">{financialData.savingRate}%</p>
                  <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-tighter">Retained of income</p>
                </div>
              </div>

              {/* Expense Trend Graph */}
              <SpendingChart expenses={expenses} startDate={startDate} endDate={endDate} />

              <div className="bg-white p-7 rounded-[40px] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h4 className="font-black text-[11px] text-slate-400 uppercase tracking-[0.2em] mb-1">Cost Distribution</h4>
                    <p className="text-lg font-bold text-slate-900">Fixed vs Variable</p>
                  </div>
                </div>
                <div className="flex h-10 rounded-2xl overflow-hidden bg-slate-100 p-1.5 mb-8 border border-slate-200">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${financialData.expenseTotal > 0 ? (financialData.fixedTotal / financialData.expenseTotal) * 100 : 0}%` }} className="bg-indigo-600 rounded-xl" />
                  <motion.div initial={{ width: 0 }} animate={{ width: `${financialData.expenseTotal > 0 ? (financialData.variableTotal / financialData.expenseTotal) * 100 : 0}%` }} className="bg-slate-300 rounded-xl ml-1" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-[28px] bg-indigo-600 text-white shadow-lg shadow-indigo-100">
                    <p className="text-[10px] font-black opacity-70 uppercase tracking-widest mb-2">Fixed (Recurring)</p>
                    <p className="text-xl font-bold">RM{financialData.fixedTotal.toLocaleString()}</p>
                  </div>
                  <div className="p-5 rounded-[28px] bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Variable (Flex)</p>
                    <p className="text-xl font-bold text-slate-800">RM{financialData.variableTotal.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-7 rounded-[40px] border border-slate-100 shadow-sm">
                <h4 className="font-black text-[11px] text-slate-400 uppercase tracking-[0.2em] mb-6">Top spending Sectors</h4>
                <div className="space-y-6">
                  {financialData.topCategories.map(([cat, amount], idx) => (
                    <div key={cat} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-700">{cat}</span>
                        <span className="text-sm font-black text-slate-900">RM{amount.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(amount / (financialData.expenseTotal || 1)) * 100}%` }} className={`h-full rounded-full ${idx === 0 ? 'bg-indigo-600' : 'bg-indigo-400'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="px-6 pb-24 text-center py-12">
            <div className="relative w-32 h-32 mx-auto mb-10">
              <div className="w-full h-full rounded-full bg-white border-[8px] border-indigo-50 shadow-2xl flex items-center justify-center text-6xl">🤵</div>
              <div className="absolute -bottom-2 -right-2 bg-indigo-600 p-3 rounded-[20px] shadow-xl border-4 border-white">
                <Award className="w-6 h-6 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Quarterly Master</h2>
            <p className="text-slate-500 font-medium tracking-wide mt-1">Analyzing {expenses.length} financial data points</p>
            
            <div className="grid grid-cols-2 gap-4 mt-12">
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Financial XP</p>
                <p className="text-2xl font-bold text-slate-800">{stats.xp}</p>
              </div>
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Wealth Ninja</p>
                <p className="text-2xl font-bold text-indigo-600">Lvl {stats.level}</p>
              </div>
            </div>

            <div className="mt-16 space-y-4">
              <button onClick={() => { if(confirm('Erase 3 months of history?')) { localStorage.clear(); window.location.reload(); } }} className="w-full bg-rose-50 text-rose-600 py-5 rounded-[28px] font-black text-[11px] uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center justify-center space-x-3">
                <Trash2 className="w-5 h-5" />
                <span>Reset Application History</span>
              </button>
            </div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col relative overflow-hidden font-['Plus_Jakarta_Sans'] text-slate-900">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-100 rounded-full blur-[100px] opacity-40 pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-rose-100 rounded-full blur-[100px] opacity-30 pointer-events-none" />

      <Header stats={stats} />
      <main className="flex-1 overflow-y-auto no-scrollbar pb-24 z-10">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>
      <TabNavigation active={activeTab} onChange={setActiveTab} />
      <AnimatePresence>
        {pendingItem && <TransactionModal item={pendingItem} existingCategories={userCategories} onCancel={() => setPendingItem(null)} onConfirm={confirmTransaction} onDelete={(id) => { setExpenses(prev => prev.filter(e => e.id !== id)); setPendingItem(null); }} />}
      </AnimatePresence>
    </div>
  );
}
