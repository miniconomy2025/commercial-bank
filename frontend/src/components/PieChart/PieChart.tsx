import React from 'react';
import './PieChart.css';

type PieChartDataItem = {
  value: number;
  color: string;
  label: string;
};

interface PieChartProps {
  data: PieChartDataItem[];
  title: string;
}

const PieChart: React.FC<PieChartProps> = ({ data, title }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = 0;

  return (
    <section className="piechart-container">
      <h2 className="piechart-title">{title}</h2>
      <figure className="piechart-figure">
        <svg width="260" height="260" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="2"
          />
          {data.map((item, index) => {
            const angle = (item.value / total) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            currentAngle += angle;

            const startRadians = (startAngle * Math.PI) / 180;
            const endRadians = (endAngle * Math.PI) / 180;

            const x1 = 100 + 90 * Math.cos(startRadians);
            const y1 = 100 + 90 * Math.sin(startRadians);
            const x2 = 100 + 90 * Math.cos(endRadians);
            const y2 = 100 + 90 * Math.sin(endRadians);

            const largeArcFlag = angle > 180 ? 1 : 0;

            const pathData = [
              `M 100 100`,
              `L ${x1} ${y1}`,
              `A 90 90 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              `Z`
            ].join(' ');

            const midAngle = (startAngle + endAngle) / 2;
            const midRadians = (midAngle * Math.PI) / 180;
            const labelX = 100 + 55 * Math.cos(midRadians);
            const labelY = 100 + 55 * Math.sin(midRadians);

            return (
              <g key={index}>
                <path
                  d={pathData}
                  fill={item.color}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12"
                  fontWeight="600"
                  dy=".35em"
                  style={{ textShadow: '1px 1px 2px #000000' }}
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>
      </figure>

      <ul className="piechart-legend">
        {data.map((item, index) => (
          <li key={index} className="piechart-legend-item">
            <span
              className="piechart-color-box"
              style={{ backgroundColor: item.color }}
            ></span>
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default PieChart;
