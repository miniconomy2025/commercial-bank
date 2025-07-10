import React from 'react';
import './LineChart.css';
import type { Account } from '../../types/Accounts';

interface ChartProps {
  selectedAccounts: string[];
  title: string;
  curveFn: (index: number) => number[];
  accounts: Account[];
}

const SVG_WIDTH = 650;
const SVG_HEIGHT = 160;
const MAX_POINTS = 10;
const PADDING = 20;

const Chart: React.FC<ChartProps> = ({ selectedAccounts, title, curveFn, accounts }) => {
  return (
    <section className="chart">
      <h3 className="chart-title">{title}</h3>
      <figure className="chart-figure">
        <svg className="chart-svg" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
          {/* Background Grid Lines */}
          {[...Array(5)].map((_, i) => {
            const y = PADDING + i * ((SVG_HEIGHT - 2 * PADDING) / 4);
            return <line key={i} x1={PADDING} x2={SVG_WIDTH - PADDING} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
          })}

          {/* Axis */}
          <line x1={PADDING} x2={PADDING} y1={PADDING} y2={SVG_HEIGHT - PADDING} stroke="#334155" />
          <line x1={PADDING} x2={SVG_WIDTH - PADDING} y1={SVG_HEIGHT - PADDING} y2={SVG_HEIGHT - PADDING} stroke="#334155" />

          {/* Data Paths */}
          {selectedAccounts.map((accountId: string, index: number) => {
            const account = accounts.find(a => a.id === accountId);
            const yValues = curveFn(index);
            if (!account || yValues.length === 0) return null;

            const maxY = Math.max(...yValues, 1);
            const xStep = (SVG_WIDTH - 2 * PADDING) / (yValues.length - 1);

            const coordinates = yValues.map((y, i) => {
              const x = PADDING + i * xStep;
              const yScaled = SVG_HEIGHT - PADDING - (y / maxY) * (SVG_HEIGHT - 2 * PADDING);
              return `${x},${yScaled}`;
            });

            return (
              <path
                key={accountId}
                d={`M ${coordinates.join(' L ')}`}
                stroke={account.color}
                strokeWidth="2"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      </figure>
    </section>
  );
};

export default Chart;
