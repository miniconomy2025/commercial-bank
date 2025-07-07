import React from 'react';
import './LineChart.css';
import type { Account } from '../../types/Accounts';
interface ChartProps {
  selectedAccounts: string[];
  title: string;
  curveFn: (index: number) => number[];
  accounts: Account[];
}

const Chart: React.FC<ChartProps> = ({ selectedAccounts, title, curveFn, accounts }) => (
  <section className="chart">
    <h3 className="chart-title">{title}</h3>
    <figure className="chart-figure">
      <svg
        className="chart-svg"
        viewBox="0 0 650 160"
        preserveAspectRatio="xMidYMid meet"
      >
        {selectedAccounts.map((accountId: string, index: number) => {
          const account = accounts.find(a => a.id === accountId);
          const yPoints = curveFn(index);
          if (!account || !yPoints.length) return null;

          // Generate x-y coordinate pairs
          const coordinates = yPoints.map((y, i) => `${i * 50},${y}`); // space out X by 50

          return (
            <path
              key={accountId}
              d={`M ${coordinates.join(' L ')}`}
              stroke={account.color}
              strokeWidth="2"
              fill="none"
            />
          );
        })}
      </svg>
    </figure>
  </section>
);

export default Chart;
