import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import './PieChart.css';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Loan {
  loan_number: string;
  initial_amount: string;
  interest_rate: string;
  started_at: string;
  write_off: boolean;
  outstanding_amount: string;
}

interface PieChartProps {
  loans: Loan[];
  title: string;
}

const PieChart: React.FC<PieChartProps> = ({ loans, title }) => {
  // Filter written-off and active loans
  const writtenOff = loans.filter(loan => loan.write_off).length;
  const active = loans.length - writtenOff;

  // Calculate total equity for active loans
  const totalEquity = loans
    .filter(loan => !loan.write_off)
    .reduce((sum, loan) => {
      const initial = parseFloat(loan.initial_amount);
      const outstanding = parseFloat(loan.outstanding_amount);
      const equity = initial - outstanding;
      return sum + (isNaN(equity) ? 0 : equity);
    }, 0)
    .toFixed(2);

  const data = {
    labels: ['Written Off', 'Active Loans'],
    datasets: [
      {
        data: [writtenOff, active],
        backgroundColor: ['#ef4444', '#10b981'],
        borderColor: ['#fff', '#fff'],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            // Add total equity to the tooltip for Active Loans
            if (label === 'Active Loans') {
              return `${label}: ${value} (${percentage}%), Total Equity: $${totalEquity}`;
            }
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <section className="piechart-container">
      <h2 className="piechart-title">{title}</h2>
      <div className="piechart-figure" style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
        <Pie data={data} options={options} />
      </div>
      {/* Display total equity below the chart */}
      <p className="piechart-equity">Total Equity (Active Loans): ${totalEquity}</p>
    </section>
  );
};

export default PieChart;