import { useState } from 'react'; 
import AggregationContent from './pages/Aggregation/Aggregation';
import IndividualAccountContent from './pages/Accounts/Accounts';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('aggregation');

  return (
    <main className="app-container">
      <header className="app-header">
        <section className="header-section">
          <h1 className="header-title">Banking Dashboard</h1>
          <p className="header-subtitle">Overview of your banking operations and key metrics</p>
        </section>

        <nav className="tab-nav">
          <button
            onClick={() => setActiveTab('aggregation')}
            className={`tab-button ${activeTab === 'aggregation' ? 'active' : ''}`}
          >
            Aggregation
          </button>
          <button
            onClick={() => setActiveTab('tab2')}
            className={`tab-button ${activeTab === 'tab2' ? 'active' : ''}`}
          >
            Individual Account Statistics
          </button>
        </nav>
      </header>

      <section className="tab-content">
        {activeTab === 'aggregation' && <AggregationContent />}
        {activeTab === 'tab2' && <IndividualAccountContent />}
      </section>
    </main>
  );
}
