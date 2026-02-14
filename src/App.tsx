import { useState } from 'react';
import './App.css';
import { Layout } from './components/Layout/Layout.tsx';
import { Sidebar } from './components/Sidebar/Sidebar.tsx';
import { WoodcuttingPage } from './pages/WoodcuttingPage/WoodcuttingPage.tsx';
import { MiningPage } from './pages/MiningPage/MiningPage.tsx';

import { ShopPage } from './pages/ShopPage/ShopPage.tsx';
import { InventoryPage } from './pages/InventoryPage/InventoryPage.tsx';
import { BuildingPage } from './pages/BuildingPage/BuildingPage.tsx';
import { AdventurerPage } from './pages/AdventurerPage/AdventurerPage.tsx';
import { DebugPage } from './pages/DebugPage/DebugPage.tsx';
import { GuildHallPage } from './pages/GuildHallPage/GuildHallPage.tsx';
import { DungeonPage } from './pages/DungeonPage/DungeonPage.tsx';

type TabId = 'woodcutting' | 'mining' | 'building' | 'adventurer' | 'guild-hall' | 'dungeon' | 'shop' | 'inventory' | 'debug';

const TABS = [
  { id: 'woodcutting' as const, label: '伐木', icon: '🪓' },
  { id: 'mining' as const, label: '采矿', icon: '⛏️' },
  { id: 'building' as const, label: '建筑', icon: '🏗️' },
  { id: 'adventurer' as const, label: '冒险者', icon: '🧙' },
  { id: 'guild-hall' as const, label: '队伍', icon: '👥' },
  { id: 'dungeon' as const, label: '副本', icon: '🏰' },
  { id: 'shop' as const, label: '商店', icon: '🏪' },
  { id: 'inventory' as const, label: '背包', icon: '🎒' },
  { id: 'debug' as const, label: '调试', icon: '🛠️' },
];

function renderPage(tabId: TabId) {
  switch (tabId) {
    case 'woodcutting': {
      return <WoodcuttingPage />;
    }
    case 'mining': {
      return <MiningPage />;
    }
    case 'building': {
      return <BuildingPage />;
    }
    case 'adventurer': {
      return <AdventurerPage />;
    }
    case 'guild-hall': {
      return <GuildHallPage />;
    }
    case 'dungeon': {
      return <DungeonPage />;
    }
    case 'shop': {
      return <ShopPage />;
    }
    case 'inventory': {
      return <InventoryPage />;
    }
    case 'debug': {
      return <DebugPage />;
    }
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('woodcutting');

  return (
    <Layout
      sidebar={
        <Sidebar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as TabId)}
        />
      }
    >
      {renderPage(activeTab)}
    </Layout>
  );
}

export default App;
