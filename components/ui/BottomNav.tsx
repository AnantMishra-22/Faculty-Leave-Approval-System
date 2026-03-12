'use client'

interface Tab {
  id: string
  label: string
  icon: string
}

interface BottomNavProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  variant?: 'faculty' | 'hod'
}

export default function BottomNav({ tabs, activeTab, onTabChange, variant = 'faculty' }: BottomNavProps) {
  if (variant === 'faculty') {
    // Faculty style: 4 tabs with center FAB
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-lg px-6 pb-6 pt-3">
        <div className="flex items-center justify-between">
          {tabs.map((tab, index) => {
            const isCenter = index === 2
            const isActive = activeTab === tab.id
            if (isCenter) {
              return (
                <div key={tab.id} className="relative -top-8">
                  <button
                    onClick={() => onTabChange(tab.id)}
                    className={`flex h-14 w-14 items-center justify-center rounded-full shadow-xl ring-4 ring-background-light dark:ring-background-dark transition-colors ${
                      isActive
                        ? 'bg-primary text-white shadow-primary/40'
                        : 'bg-primary text-white shadow-primary/40'
                    }`}
                  >
                    <span className="material-symbols-outlined text-3xl">{tab.icon}</span>
                  </button>
                  <span className={`block text-center text-[10px] font-bold mt-1 ${isActive ? 'text-primary' : 'text-slate-400'}`}>
                    {tab.label}
                  </span>
                </div>
              )
            }
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                <span className="text-[10px] font-bold">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    )
  }

  // HOD style: 5 tabs with QR center elevated button
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-1 shadow-2xl">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {tabs.map((tab, index) => {
          const isCenter = index === 2
          const isActive = activeTab === tab.id
          if (isCenter) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="flex flex-col items-center gap-1 -mt-8"
              >
                <div className={`h-12 w-12 rounded-full flex items-center justify-center shadow-lg border-4 transition-colors ${
                  isActive
                    ? 'bg-primary text-white shadow-primary/40 border-primary/20 dark:border-slate-900'
                    : 'bg-primary text-white shadow-primary/40 border-white dark:border-slate-900'
                }`}>
                  <span className="material-symbols-outlined text-2xl">{tab.icon}</span>
                </div>
                <span className={`text-[10px] font-medium mt-1 ${isActive ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}>
                  {tab.label}
                </span>
              </button>
            )
          }
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}
            >
              <span className="material-symbols-outlined">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
